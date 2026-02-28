'use server';

import { getSession } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE_BYTES, Role } from '@/lib/constants';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { WorkflowDocument, DocumentFormState } from '@/types/workflow';
import { DocumentStatus } from '@/lib/constants';

const STORAGE_BUCKET = 'workflow-documents';

function mapDocument(d: Record<string, unknown>): WorkflowDocument {
  return {
    id: d.id as string,
    workflowId: d.workflow_id as string,
    uploadedBy: d.uploaded_by as string,
    name: d.name as string,
    fileType: d.file_type as string,
    storagePath: d.storage_path as string,
    fileSizeBytes: (d.file_size_bytes as number | null) ?? null,
    status: d.status as DocumentStatus,
    errorMessage: (d.error_message as string | null) ?? null,
    chunkCount: (d.chunk_count as number | null) ?? null,
    createdAt: new Date(d.created_at as string),
    updatedAt: new Date(d.updated_at as string),
  };
}

// ============================================================
// Step 1: Create document record + return signed upload URL
// ============================================================

export async function initiateDocumentUploadAction(
  prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, errors: {}, formData: { workflow_id: '' }, globalError: 'Unauthorized' };
    }

    const workflowId = formData.get('workflow_id')?.toString() ?? '';
    const fileName = formData.get('file_name')?.toString() ?? '';
    const fileSize = parseInt(formData.get('file_size')?.toString() ?? '0');

    if (!workflowId) {
      return { success: false, errors: { workflow_id: ['workflowIdRequired'] }, formData: { workflow_id: '' }, globalError: null };
    }

    // Validate file type
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
      return { success: false, errors: {}, formData: { workflow_id: workflowId }, globalError: 'unsupportedFileType' };
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return { success: false, errors: {}, formData: { workflow_id: workflowId }, globalError: 'fileTooLarge' };
    }

    const isAdmin = session.user.role === Role.ADMIN;

    // Admins can access any workflow; regular users must be assigned
    if (isAdmin) {
      const adminClient = createAdminClient();
      const { data: workflow } = await adminClient
        .from('workflows')
        .select('id')
        .eq('id', workflowId)
        .single();

      if (!workflow) {
        return { success: false, errors: {}, formData: { workflow_id: workflowId }, globalError: 'workflowNotFound' };
      }
    } else {
      const supabase = await createClient();
      const { data: assignment } = await supabase
        .from('user_workflows')
        .select('workflow_id')
        .eq('workflow_id', workflowId)
        .eq('user_id', session.user.id)
        .single();

      if (!assignment) {
        return { success: false, errors: {}, formData: { workflow_id: workflowId }, globalError: 'workflowNotFound' };
      }
    }

    const adminClient = createAdminClient();

    // Create document record — sanitize filename for storage path (keep original for display)
    const sanitizedName = fileName.replace(/[^\x20-\x7E]/g, '_');
    const storagePath = `${workflowId}/${session.user.id}/${Date.now()}_${sanitizedName}`;
    const { data: doc, error: insertError } = await adminClient
      .from('documents')
      .insert({
        workflow_id: workflowId,
        uploaded_by: session.user.id,
        name: fileName,
        file_type: ext,
        storage_path: storagePath,
        file_size_bytes: fileSize || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !doc) throw insertError ?? new Error('Failed to create document');

    // Create signed upload URL (valid for 5 minutes)
    const { data: uploadData, error: urlError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (urlError || !uploadData) throw urlError ?? new Error('Failed to create upload URL');

    logger.info('Document upload initiated', { documentId: doc.id, userId: session.user.id });

    return {
      success: true,
      errors: {},
      formData: { workflow_id: workflowId },
      globalError: null,
      documentId: doc.id,
      signedUploadUrl: uploadData.signedUrl,
    };
  } catch (error) {
    logger.error('Error initiating document upload', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: { workflow_id: formData.get('workflow_id')?.toString() ?? '' },
      globalError: 'unexpectedError',
    };
  }
}

// ============================================================
// Step 2: Mark as processing and fire processing pipeline
// ============================================================

export async function triggerDocumentProcessingAction(documentId: string) {
  try {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const adminClient = createAdminClient();

    // Mark as processing
    const { error: updateError } = await adminClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Fire-and-forget: call processDocument directly (no HTTP round-trip)
    const { processDocument } = await import('@/lib/process-document');
    processDocument(documentId).catch((err) => {
      logger.error('Failed to process document', { error: (err as Error).message });
    });

    return { success: true };
  } catch (error) {
    logger.error('Error triggering processing', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Delete document (storage + DB + KB rows)
// ============================================================

export async function deleteDocumentAction(documentId: string) {
  try {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const adminClient = createAdminClient();

    // Fetch document to get storage path and workflow_id
    const { data: doc, error: fetchError } = await adminClient
      .from('documents')
      .select('storage_path, workflow_id, uploaded_by')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) throw new Error('Document not found');

    // Verify access: admins can delete any document; users must be assigned to the workflow
    const isAdmin = session.user.role === Role.ADMIN;
    if (!isAdmin) {
      const supabase = await createClient();
      const { data: assignment } = await supabase
        .from('user_workflows')
        .select('workflow_id')
        .eq('workflow_id', doc.workflow_id)
        .eq('user_id', session.user.id)
        .single();

      if (!assignment) throw new Error('Unauthorized');
    }

    // Delete KB rows where metadata contains this file_id
    await adminClient
      .from('knowledge_base')
      .delete()
      .eq('workflow_id', doc.workflow_id)
      .filter('metadata->>file_id', 'eq', documentId);

    // Delete from storage
    await adminClient.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);

    // Delete document record (cascades any remaining relations)
    const { error: deleteError } = await adminClient
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) throw deleteError;

    logger.info('Document deleted', { documentId, userId: session.user.id });
    revalidatePath('/workflow');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting document', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Get documents for a workflow (user-scoped, RLS enforced)
// ============================================================

export async function getDocumentsForWorkflow(workflowId: string): Promise<WorkflowDocument[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((d) => mapDocument(d as Record<string, unknown>));
  } catch (error) {
    logger.error('Error fetching documents', { error: (error as Error).message });
    throw error;
  }
}
