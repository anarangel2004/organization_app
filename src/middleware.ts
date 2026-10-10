import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Se o Supabase estiver lento, não bloquear a página (o Vercel desiste ao fim de
  // alguns segundos com 504 MIDDLEWARE_INVOCATION_TIMEOUT). Sem resposta em 4 s,
  // deixa passar: as próprias páginas voltam a confirmar a sessão no browser.
  const result = await Promise.race([
    supabase.auth.getUser().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  if (!result) return response;
  const user = result.data.user;

  const isProtectedRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/faculdade') ||
    request.nextUrl.pathname.startsWith('/trabalho') ||
    request.nextUrl.pathname.startsWith('/estudo');

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/faculdade', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/faculdade/:path*', '/trabalho/:path*', '/estudo/:path*', '/login'],
};