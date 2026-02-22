'use client';

import { useState, useRef, useTransition } from 'react';
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
import { DocumentStatus, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/constants';

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
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileRef.current) return;
    fileRef.current.value = '';

    if (!file) return;

    // Client-side validation
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
      setAlert({ message: t('unsupportedFileType'), type: 'error' });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAlert({ message: t('fileTooLarge'), type: 'error' });
      return;
    }

    setUploading(true);
    setAlert(null);

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
        setAlert({ message: t(result.globalError ?? 'unexpectedError'), type: 'error' });
        return;
      }

      // Step 2: Upload directly to Supabase Storage
      const uploadRes = await fetch(result.signedUploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      // Step 3: Trigger processing
      await triggerDocumentProcessingAction(result.documentId);

      // Step 4: Start polling
      startPolling(result.documentId);
      router.refresh();
    } catch {
      setAlert({ message: t('unexpectedError'), type: 'error' });
    } finally {
      setUploading(false);
    }
  };

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

        {/* Upload area */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.docx,.md"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? t('loading') : t('uploadDocument')}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            {t('uploadDocumentHint')}
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
