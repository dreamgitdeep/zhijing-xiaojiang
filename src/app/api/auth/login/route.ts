import { NextResponse } from 'next/server';
import { login, rateLimited } from '@/lib/auth-service';

// 登录限流（安全加固 P1-2）：IP + 账号双维度，键名与 reset 路由同习惯。
// IP 维度放宽到 30 次/分：全班学生可能从同一教室 NAT 出口集中登录，过紧会误伤；
// 账号维度 5 次/分是单账号暴破的主防线。
const LOGIN_IP_LIMIT_PER_MIN = 30;
const LOGIN_USER_LIMIT_PER_MIN = 5;

function rateLimitResponse() {
  return NextResponse.json(
    { error: '尝试过于频繁，请 1 分钟后再试' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(`login-ip:${ip}`, LOGIN_IP_LIMIT_PER_MIN, 60_000)) {
    return rateLimitResponse();
  }
  const body = await req.json().catch(() => ({}));
  const identifier = String(body.identifier ?? '').trim().toLowerCase();
  if (identifier && rateLimited(`login-user:${identifier}`, LOGIN_USER_LIMIT_PER_MIN, 60_000)) {
    return rateLimitResponse();
  }
  const result = await login({
    identifier: String(body.identifier ?? ''),
    password: String(body.password ?? ''),
    remember: Boolean(body.remember)
  });
  return NextResponse.json(result);
}
