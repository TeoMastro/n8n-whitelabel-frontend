'use client';

import { useState, useRef, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  initiateDocumentUploadAction,
  triggerDocumentProcessingAction,
  deleteDocumentAction,
} from '@/server-actions/document';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Upload, Trash2, Database } from 'lucide-react';
import { InfoAlert } from '@/components/info-alert';
import { WorkflowDocument } from '@/types/workflow';
import { DocumentStatus, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE_BYTES, MAX_UPLOAD_FILES } from '@/lib/constants';

interface DocumentManagerProps {
  workflowId: string;
  initialDocuments: WorkflowDocument[];
}

const STATUS_VARIANT: Record<DocumentStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  processing: 'outline',
  ready: 'default',
  error: 'destructive',
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentManager({ workflowId, initialDocuments }: DocumentManagerProps) {
  const t = useTranslations('app');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);

  const startPolling = (documentId: string) => {
    setPollingIds((prev) => new Set(prev).add(documentId));

    const interval = setInterval(async () => {
      const res = await fetch(`/api/documents/status?id=${documentId}`);
      if (!res.ok) { clearInterval(interval); return; }

      const data = (await res.json()) as { status: string };
      if (data.status === 'ready' || data.status === 'error') {
        clearInterval(interval);
        setPollingIds((prev) => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
        router.refresh();
      }
    }, 3000);
  };

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length > MAX_UPLOAD_FILES) {
      setAlert({ message: t('tooManyFiles', { max: MAX_UPLOAD_FILES }), type: 'error' });
      return;
    }

    // Client-side validation: filter valid files and collect skipped ones
    const validFiles: File[] = [];
    const skippedNames: string[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
        skippedNames.push(`${file.name} (${t('unsupportedFileType')})`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        skippedNames.push(`${file.name} (${t('fileTooLarge')})`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setAlert({ message: skippedNames.join(', '), type: 'error' });
      return;
    }

    setUploading(true);
    setAlert(null);
    setUploadProgress({ current: 0, total: validFiles.length });

    let successCount = 0;
    const failedNames: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgress({ current: i + 1, total: validFiles.length });

      try {
        // Step 1: Create document record + get signed URL
        const formData = new FormData();
        formData.append('workflow_id', workflowId);
        formData.append('file_name', file.name);
        formData.append('file_size', String(file.size));
        formData.append('file_type', file.type);

        const result = await initiateDocumentUploadAction(
          { success: false, errors: {}, formData: { workflow_id: workflowId }, globalError: null },
          formData
        );

        if (!result.success || !result.documentId || !result.signedUploadUrl) {
          failedNames.push(file.name);
          continue;
        }

        // Step 2: Upload directly to Supabase Storage
        const uploadRes = await fetch(result.signedUploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });

        if (!uploadRes.ok) {
          failedNames.push(file.name);
          continue;
        }

        // Step 3: Trigger processing
        await triggerDocumentProcessingAction(result.documentId);

        // Step 4: Start polling
        startPolling(result.documentId);
        successCount++;
      } catch {
        failedNames.push(file.name);
      }
    }

    // Build result message
    if (failedNames.length > 0 && successCount > 0) {
      setAlert({
        message: `${failedNames.join(', ')} ${t('uploadFailed')}. ${t('uploadSuccessCount', { count: successCount })}`,
        type: 'error',
      });
    } else if (failedNames.length > 0) {
      setAlert({ message: `${failedNames.join(', ')} ${t('uploadFailed')}`, type: 'error' });
    } else if (skippedNames.length > 0) {
      setAlert({
        message: t('uploadPartialSuccess', { success: successCount, failed: skippedNames.length }),
        type: 'success',
      });
    }

    router.refresh();
    setUploading(false);
    setUploadProgress(null);
  }, [workflowId, t, router, startPolling]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (fileRef.current) fileRef.current.value = '';
    await handleFiles(files);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (uploading || isPending) return;
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [uploading, isPending, handleFiles]);

  const handleDelete = (documentId: string) => {
    startTransition(async () => {
      try {
        await deleteDocumentAction(documentId);
        setAlert({ message: t('documentDeletedSuccess'), type: 'success' });
        router.refresh();
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          {t('knowledgeBase')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alert && <InfoAlert message={alert.message} type={alert.type} />}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && !isPending && fileRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
            ${(uploading || isPending) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.docx,.md"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">
            {uploading && uploadProgress
              ? t('uploadingProgress', { current: uploadProgress.current, total: uploadProgress.total })
              : t('dropFilesHere')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('uploadDocumentsHint')}
          </p>
        </div>

        {/* Documents list */}
        {initialDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('noDocumentsFound')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documentName')}</TableHead>
                <TableHead>{t('documentStatus')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[140px]">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSizeBytes)}
                        {doc.chunkCount ? ` · ${doc.chunkCount} chunks` : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[doc.status]}>
                      {t(`documentStatus${doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}` as Parameters<typeof t>[0])}
                    </Badge>
                    {pollingIds.has(doc.id) && (
                      <span className="ml-1 text-xs text-muted-foreground animate-pulse">…</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteDocumentConfirmation', { name: doc.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                          >
                            {t('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
