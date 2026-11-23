import { NextResponse } from 'next/server';
import { resetPassword, rateLimited } from '@/lib/auth-service';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(`reset-ip:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: '尝试过于频繁，请 15 分钟后再试' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await resetPassword({
    identifier: String(body.identifier ?? ''),
    code: String(body.code ?? ''),
    password: String(body.password ?? '')
  });
  return NextResponse.json(result);
}
