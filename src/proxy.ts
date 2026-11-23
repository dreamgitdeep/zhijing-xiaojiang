import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'zj_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
// access 剩余有效期低于该阈值时触发续期（access 有效期 1 小时）
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// 同一 refresh token 的并发续期去重：GoTrue 轮转 refresh token，
// 并发各刷一次会让后到请求拿到已失效的旧 token
const inflight = new Map<string, Promise<{ access: string; refresh: string } | null>>();

function accessExpMs(jwt: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function refreshTokens(refreshToken: string): Promise<{ access: string; refresh: string } | null> {
  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.access_token && j.refresh_token ? { access: j.access_token, refresh: j.refresh_token } : null;
  } catch {
    return null;
  }
}

function rewriteCookieHeader(header: string | null, value: string): string {
  const parts = (header ?? '').split(';').map((s) => s.trim()).filter(Boolean);
  const next = parts.filter((p) => !p.startsWith(`${SESSION_COOKIE}=`));
  next.push(`${SESSION_COOKIE}=${value}`);
  return next.join('; ');
}

export async function proxy(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.next();

  const sep = raw.indexOf('|');
  const access = sep === -1 ? raw : raw.slice(0, sep);
  const refresh = sep === -1 ? null : raw.slice(sep + 1);
  const exp = accessExpMs(access);

  // 旧格式（无 refresh）或有效期充足：不续期
  if (!refresh || exp === null || exp - Date.now() > REFRESH_MARGIN_MS) return NextResponse.next();

  let pending = inflight.get(refresh);
  if (!pending) {
    pending = refreshTokens(refresh);
    inflight.set(refresh, pending);
    void pending.finally(() => inflight.delete(refresh));
  }
  const renewed = await pending;

  if (!renewed) {
    // 续期失败视为登出：清 cookie
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'none', secure: true, path: '/', maxAge: 0 });
    return res;
  }

  const value = `${renewed.access}|${renewed.refresh}`;
  // 下游（本页渲染 / API 路由）立即使用新 access，无需等下一次请求
  const headers = new Headers(req.headers);
  headers.set('cookie', rewriteCookieHeader(req.headers.get('cookie'), value));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(SESSION_COOKIE, value, { httpOnly: true, sameSite: 'none', secure: true, path: '/', maxAge: SESSION_MAX_AGE });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|data/|robots.txt).*)'],
};
