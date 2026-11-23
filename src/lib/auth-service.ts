import { createHash, randomInt } from 'crypto';
import { getAdminClient, isCloudConfigured } from '@/lib/supabase-server';
import { setSessionCookie, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

import { EMAIL_DOMAIN, CLASS_CODES } from '@/lib/auth-constants';

export { EMAIL_DOMAIN, CLASS_CODES };

export interface AuthResult {
  ok?: boolean;
  role?: 'student' | 'teacher';
  error?: string;
}

export async function login(input: { identifier: string; password: string; remember: boolean }): Promise<AuthResult> {
  if (!isCloudConfigured()) {
    return { error: '云端数据模式未启用，请联系管理员配置 Supabase' };
  }
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) return { error: '请输入学号 / 账号和密码' };

  const admin = getAdminClient();
  const email = `${identifier.toLowerCase()}@${EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.signInWithPassword({ email, password: input.password });
  if (error || !data.session) {
    return { error: '学号 / 账号或密码不正确' };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  const role = (profile?.role as 'student' | 'teacher') ?? 'student';

  await setSessionCookie(data.session.access_token, data.session.refresh_token ?? null, input.remember);
  return { ok: true, role };
}

export async function register(input: {
  role: string;
  name: string;
  email: string;
  password: string;
  account?: string;
  studentNo?: string;
  classCode?: string;
  inviteCode?: string;
}): Promise<AuthResult> {
  if (!isCloudConfigured()) {
    return { error: '云端数据模式未启用，请联系管理员配置 Supabase' };
  }
  const role = input.role === 'teacher' ? 'teacher' : 'student';
  const name = input.name.trim();
  const contactEmail = input.email.trim();
  const password = input.password;

  if (!name) return { error: '请填写姓名' };
  if (!contactEmail || !contactEmail.includes('@')) return { error: '请填写有效的邮箱' };
  if (password.length < 6) return { error: '密码至少 6 位' };

  const admin = getAdminClient();

  if (role === 'teacher') {
    // 邀请码门槛（安全加固 P0-1）：环境变量未配置时整体关闭教师注册（fail-closed）。
    // 比较结果不回显、不落日志，避免邀请码明文外泄。
    const expectedInvite = process.env.TEACHER_INVITE_CODE;
    if (!expectedInvite || !expectedInvite.trim()) {
      return { error: '教师注册暂未开放，请联系管理员' };
    }
    if ((input.inviteCode ?? '').trim() !== expectedInvite) {
      return { error: '教师邀请码不正确，请向管理员索取' };
    }
    const account = (input.account ?? '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(account)) {
      return { error: '教师账号需为 3-20 位字母、数字或下划线' };
    }
    const email = `${account.toLowerCase()}@${EMAIL_DOMAIN}`;
    const { data, error } = await admin.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, student_no: null, class_name: null, account, contact_email: contactEmail }
      }
    });
    if (error || !data.session) {
      const message = error?.message ?? '注册失败';
      if (message.includes('already registered') || message.includes('already exists')) {
        return { error: '该账号已注册，请直接登录' };
      }
      return { error: `注册失败：${message}` };
    }
    await setSessionCookie(data.session.access_token, data.session.refresh_token ?? null, true);
    return { ok: true, role };
  }

  const studentNo = (input.studentNo ?? '').trim();
  if (!studentNo) return { error: '请填写学号' };
  const classCode = (input.classCode ?? '').trim().toLowerCase();
  let className: string | null = null;
  if (classCode) {
    className = CLASS_CODES[classCode] ?? null;
    if (!className) {
      const { data: cls } = await admin.from('classes').select('name').eq('invite_code', classCode).maybeSingle();
      className = (cls?.name as string | undefined) ?? null;
    }
    if (!className) return { error: '班级邀请码不正确，可留空或咨询授课教师' };
  }

  const email = `${studentNo.toLowerCase()}@${EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.signUp({
    email,
    password,
    options: {
      data: { name, role, student_no: studentNo, class_name: className, class_code: classCode || null, contact_email: contactEmail, account: studentNo }
    }
  });
  if (error || !data.session) {
    const message = error?.message ?? '注册失败';
    if (message.includes('already registered') || message.includes('already exists')) {
      return { error: '该学号已注册，请直接登录' };
    }
    return { error: `注册失败：${message}` };
  }

  await setSessionCookie(data.session.access_token, data.session.refresh_token ?? null, true);
  return { ok: true, role };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, httpOnly: true, sameSite: 'none', secure: true, path: '/' });
}

// ---- 一次性重置码 ----

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_MAX_FAILS = 5;

const limiterBuckets = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (limiterBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    limiterBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  limiterBuckets.set(key, hits);
  return false;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

async function findUserByIdentifier(admin: ReturnType<typeof getAdminClient>, identifier: string) {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .or(`student_no.eq.${identifier},account.eq.${identifier}`)
    .limit(1)
    .maybeSingle();
  if (profile) return profile.id as string;
  const email = `${identifier.toLowerCase()}@${EMAIL_DOMAIN}`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
  return list?.users.find((u) => u.email === email)?.id ?? null;
}

export async function createResetCode(input: { studentNo: string; teacherId: string }): Promise<{ ok?: boolean; code?: string; expiresAt?: string; error?: string }> {
  if (!isCloudConfigured()) return { error: '云端数据模式未启用，请联系管理员配置 Supabase' };
  const studentNo = input.studentNo.trim();
  if (!studentNo) return { error: '请输入学号' };
  if (rateLimited(`reset-gen:${input.teacherId}`, 5, 60_000)) {
    return { error: '生成过于频繁，请稍后再试' };
  }

  const admin = getAdminClient();
  const userId = await findUserByIdentifier(admin, studentNo);
  if (!userId) return { error: '该学号尚未注册' };

  const now = new Date();
  const { data: active } = await admin
    .from('password_reset_codes')
    .select('id')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', now.toISOString());
  if (active && active.length > 0) {
    await admin
      .from('password_reset_codes')
      .update({ used_at: now.toISOString() })
      .in('id', active.map((r) => r.id));
  }

  const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
  const expiresAt = new Date(now.getTime() + RESET_CODE_TTL_MS);
  const { error } = await admin.from('password_reset_codes').insert({
    user_id: userId,
    code_hash: hashCode(code),
    expires_at: expiresAt.toISOString(),
    created_by: input.teacherId
  });
  if (error) return { error: `生成失败：${error.message}` };
  return { ok: true, code, expiresAt: expiresAt.toISOString() };
}

export async function resetPassword(input: { identifier: string; code: string; password: string }): Promise<AuthResult> {
  if (!isCloudConfigured()) {
    return { error: '云端数据模式未启用，请联系管理员配置 Supabase' };
  }
  const identifier = input.identifier.trim();
  const code = input.code.trim();
  const password = input.password;
  if (!identifier || !code || !password) return { error: '请填写学号 / 账号、重置码和新密码' };
  if (password.length < 6) return { error: '密码至少 6 位' };

  const admin = getAdminClient();
  const userId = await findUserByIdentifier(admin, identifier);
  if (!userId) return { error: '重置码不正确或已失效' };

  const now = new Date();
  const { data: candidates } = await admin
    .from('password_reset_codes')
    .select('id, code_hash, fail_count')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', now.toISOString())
    .lt('fail_count', RESET_CODE_MAX_FAILS);

  const matched = candidates?.find((c) => c.code_hash === hashCode(code));
  if (!matched) {
    for (const c of candidates ?? []) {
      await admin
        .from('password_reset_codes')
        .update({ fail_count: c.fail_count + 1 })
        .eq('id', c.id);
    }
    return { error: '重置码不正确或已失效' };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) return { error: `重置失败：${updateError.message}` };
  await admin.from('password_reset_codes').update({ used_at: now.toISOString() }).eq('id', matched.id);
  return { ok: true };
}
