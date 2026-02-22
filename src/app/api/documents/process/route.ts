import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';
import OpenAI from 'openai';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const STORAGE_BUCKET = 'workflow-documents';

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}

async function parseFileToText(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<string> {
  if (fileType === 'pdf') {
    // pdf-parse v2 — import worker first, then use PDFParse class
    await import('pdf-parse/worker');
    const { PDFParse, VerbosityLevel } = await import('pdf-parse');
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      verbosity: VerbosityLevel.WARNINGS,
    });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  }

  if (fileType === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // txt / md — plain text
  return buffer.toString('utf-8');
}

export async function POST(req: NextRequest) {
  let documentId: string | undefined;

  try {
    const body = await req.json();
    documentId = body.documentId as string;
    const userId = body.userId as string;

    if (!documentId || !userId) {
      return NextResponse.json({ error: 'Missing documentId or userId' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Parse to text
    const text = await parseFileToText(buffer, doc.file_type, doc.name);

    if (!text.trim()) {
      await supabase
        .from('documents')
        .update({ status: 'error', error_message: 'Could not extract text from document' })
        .eq('id', documentId);
      return NextResponse.json({ error: 'Empty document' }, { status: 422 });
    }

    // Chunk text
    const chunks = chunkText(text);

    // Embed with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Batch in groups of 100 to respect token limits
    const EMBED_BATCH = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    // Build knowledge_base rows
    const rows = chunks.map((content, idx) => ({
      content,
      metadata: {
        doc_id: `${documentId}_${idx}`,
        file_id: documentId,
        chunk_index: idx,
        document_name: doc.name,
        file_type: doc.file_type,
        workflow_id: doc.workflow_id,
      },
      embedding: allEmbeddings[idx],
      workflow_id: doc.workflow_id,
    }));

    // Delete any existing KB rows for this document (in case of reprocessing)
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('workflow_id', doc.workflow_id)
      .filter('metadata->>file_id', 'eq', documentId);

    // Insert in batches of 50
    const DB_BATCH = 50;
    for (let i = 0; i < rows.length; i += DB_BATCH) {
      const batch = rows.slice(i, i + DB_BATCH);
      const { error: insertError } = await supabase
        .from('knowledge_base')
        .insert(batch);
      if (insertError) throw insertError;
    }

    // Mark document as ready
    await supabase
      .from('documents')
      .update({ status: 'ready', chunk_count: chunks.length })
      .eq('id', documentId);

    logger.info('Document processed', { documentId, chunks: chunks.length });

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (error) {
    logger.error('Document processing failed', {
      documentId,
      error: (error as Error).message,
    });

    if (documentId) {
      const supabase = createAdminClient();
      await supabase
        .from('documents')
        .update({ status: 'error', error_message: (error as Error).message })
        .eq('id', documentId);
    }

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
