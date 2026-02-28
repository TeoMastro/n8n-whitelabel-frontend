import { NextRequest, NextResponse } from 'next/server';
import { processDocument } from '@/lib/process-document';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const documentId = body.documentId as string;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    const result = await processDocument(documentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.error === 'Document not found' ? 404 : 500 });
    }

    return NextResponse.json({ success: true, chunks: result.chunks });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
