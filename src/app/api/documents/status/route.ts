import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, status, chunk_count, error_message, uploaded_by')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (data.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    chunkCount: data.chunk_count,
    errorMessage: data.error_message,
  });
}
