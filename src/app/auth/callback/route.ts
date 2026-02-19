import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/dashboard';
  // Prevent open redirect: only allow relative paths, block protocol-relative URLs
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard';

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(
          new URL(next, `http://${request.headers.get('host')}`)
        );
      } else if (forwardedHost) {
        return NextResponse.redirect(
          new URL(next, `https://${forwardedHost}`)
        );
      } else {
        return NextResponse.redirect(
          new URL(next, `https://${request.headers.get('host')}`)
        );
      }
    }
  }

  // If code exchange failed or no code, redirect to signin with error
  return NextResponse.redirect(
    new URL(
      '/auth/signin?error=Could not authenticate',
      request.url
    )
  );
}
