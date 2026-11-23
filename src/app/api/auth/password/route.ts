import { NextResponse } from 'next/server';
import { requireUserToken } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getUserClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  let body: { currentPassword?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求无效' }, { status: 400 });
  }
  const currentPassword = body.currentPassword ?? '';
  const password = (body.password ?? '').trim();
  if (!currentPassword) return NextResponse.json({ error: '请输入当前密码' });
  if (password.length < 6) return NextResponse.json({ error: '新密码至少 6 位' });
  try {
    const { token } = await requireUserToken();
    const userClient = getUserClient(token);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user?.email) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const user = userData.user;

    const { error: verifyErr } = await getSupabaseClient().auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });
    if (verifyErr) return NextResponse.json({ error: '当前密码不正确' });

    // 同 profile 路由：userClient 无 storage session，updateUser 必抛 AuthSessionMissingError；
    // 身份已由 getUser + 当前密码 signInWithPassword 双重核验，改密走 service_role
    const { error } = await getSupabaseClient().auth.admin.updateUserById(user.id, { password });
    if (error) return NextResponse.json({ error: '修改失败：' + error.message });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
}
