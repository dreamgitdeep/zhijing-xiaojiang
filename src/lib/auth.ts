import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserClient } from '@/lib/supabase-server';

export const SESSION_COOKIE = 'zj_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  role: 'student' | 'teacher';
  name: string;
  studentNo: string;
  className: string;
  contactEmail: string;
  classCode: string;
  account: string;
}

// cookie 值格式：`${access_token}|${refresh_token}`；旧格式（无 |）仅含 access，无法续期
export function parseSessionValue(raw: string): { access: string; refresh: string | null } {
  const sep = raw.indexOf('|');
  return sep === -1 ? { access: raw, refresh: null } : { access: raw.slice(0, sep), refresh: raw.slice(sep + 1) };
}

export async function setSessionCookie(access: string, refresh: string | null, remember = true) {
  const store = await cookies();
  store.set(SESSION_COOKIE, refresh ? `${access}|${refresh}` : access, {
    httpOnly: true,
    // 预览页以跨站 iframe 嵌入，SameSite=None+Secure 才能让 cookie 在第三方上下文携带
    sameSite: 'none',
    secure: true,
    path: '/',
    ...(remember ? { maxAge: SESSION_MAX_AGE } : {}),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// 返回 access_token（cookie 中的 refresh 部分由 middleware 续期链路使用）
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? parseSessionValue(raw).access : null;
}

const sessionCache = new Map<string, { user: SessionUser; exp: number }>();

export function invalidateSessionCache(token: string) {
  sessionCache.delete(token);
}

// access_token 是 JWT，payload.sub 即用户 id；解出后按 id 精确查，
// 避免教师因 profiles RLS（self OR is_teacher()）可见多行导致 maybeSingle 报错
function uidFromSessionToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const hit = sessionCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  const uid = uidFromSessionToken(token);
  if (!uid) return null;
  try {
    const client = getUserClient(token);
    const { data, error } = await client
      .from('profiles')
      .select('id, role, name, student_no, class_name, contact_email, class_code, account')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;
    const user: SessionUser = {
      id: data.id,
      role: (data.role as 'student' | 'teacher') ?? 'student',
      name: data.name ?? '',
      studentNo: data.student_no ?? '',
      className: data.class_name ?? '',
      contactEmail: data.contact_email ?? '',
      classCode: data.class_code ?? '',
      account: data.account ?? '',
    };
    sessionCache.set(token, { user, exp: Date.now() + 120_000 });
    if (sessionCache.size > 1000) sessionCache.delete(sessionCache.keys().next().value as string);
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/');
  return user;
}

export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'teacher') redirect('/learning');
  return user;
}

export async function requireUserToken(): Promise<{ user: SessionUser; token: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('UNAUTHORIZED');
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return { user, token };
}

export async function getAuthContext(): Promise<{ token: string; userId: string } | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const { data, error } = await getUserClient(token).auth.getUser();
    if (error || !data.user) return null;
    return { token, userId: data.user.id };
  } catch {
    return null;
  }
}
