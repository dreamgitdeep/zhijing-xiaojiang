import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth-service';
import { invalidateSessionCache, parseSessionValue, SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value || '';
  await logout();
  invalidateSessionCache(parseSessionValue(raw).access);
  return NextResponse.json({ ok: true });
}
