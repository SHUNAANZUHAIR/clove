import { NextRequest, NextResponse } from 'next/server';

const cookieName = 'clovehr_session';
const encoder = new TextEncoder();

async function validSession(value?: string) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || Number(parts[1]) <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const secret = process.env.CLOVEHR_AUTH_SECRET || 'clovehr-site-session-v1';
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return expected === parts[2];
}

export async function middleware(request: NextRequest) {
  const signedIn = await validSession(request.cookies.get(cookieName)?.value);
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/login') return signedIn ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (!signedIn) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|verify-agreement).*)'] };
