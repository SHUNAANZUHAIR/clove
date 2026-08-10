import { NextRequest, NextResponse } from 'next/server';

const cookieName = 'clovehr_session';
const encoder = new TextEncoder();
const validBusinesses = new Set(['construction', 'clove_cafe', 'clove_guesthouse']);

interface Session {
  business: string;
  siteId: number;
}

async function validSession(value?: string): Promise<Session | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [business, siteIdRaw, expiresRaw, signature] = parts;
  if (!validBusinesses.has(business) || Number(expiresRaw) <= Math.floor(Date.now() / 1000)) return null;
  const payload = `${business}.${siteIdRaw}.${expiresRaw}`;
  const secret = process.env.CLOVEHR_AUTH_SECRET || 'clovehr-site-session-v1';
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signatureBytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (expected !== signature) return null;
  const siteId = Number(siteIdRaw);
  if (!Number.isInteger(siteId)) return null;
  return { business, siteId };
}

export async function middleware(request: NextRequest) {
  const session = await validSession(request.cookies.get(cookieName)?.value);
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/';
  // Workflow endpoints perform their own Bearer-token authentication. The
  // OpenAPI document must remain public so ChatGPT can import and refresh it.
  if (pathname === '/api/clovehr/openapi' || pathname.startsWith('/api/clovehr/workflow')) {
    return preventSharedCaching(NextResponse.next());
  }
  // The OT self-service timesheet, staff onboarding, and recruitment intake
  // are reachable without a site login (kiosk links from the sign-in
  // screen), so they and their APIs must stay public.
  if (pathname === '/submit-ot' || pathname === '/onboard-employee' || pathname === '/recruitment' || pathname.startsWith('/api/public/')) {
    return preventSharedCaching(NextResponse.next());
  }
  if (pathname === '/login') {
    return preventSharedCaching(session ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next());
  }
  if (!session) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return preventSharedCaching(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
    }
    return preventSharedCaching(NextResponse.redirect(new URL('/login', request.url)));
  }
  const headers = new Headers(request.headers);
  headers.set('x-clovehr-site-id', String(session.siteId));
  headers.set('x-clovehr-business', session.business);
  return preventSharedCaching(NextResponse.next({ request: { headers } }));
}

function preventSharedCaching(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|verify-agreement).*)'] };
