import { NextResponse } from 'next/server';
import { register } from '@/lib/auth-service';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await register({
    role: String(body.role ?? 'student'),
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    password: String(body.password ?? ''),
    account: body.account != null ? String(body.account) : undefined,
    studentNo: body.studentNo != null ? String(body.studentNo) : undefined,
    classCode: body.classCode != null ? String(body.classCode) : undefined,
    inviteCode: body.inviteCode != null ? String(body.inviteCode) : undefined
  });
  return NextResponse.json(result);
}
