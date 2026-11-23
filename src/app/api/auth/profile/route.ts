import { NextResponse } from 'next/server';
import { invalidateSessionCache, requireUserToken } from '@/lib/auth';
import { getAdminClient, getUserClient } from '@/lib/supabase-server';
import { CLASS_CODES } from '@/lib/auth-service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { studentNo?: string; contactEmail?: string; classCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求无效' }, { status: 400 });
  }
  try {
    const { token } = await requireUserToken();
    const userClient = getUserClient(token);
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const user = userData.user;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const role = meta.role === 'teacher' ? 'teacher' : 'student';

    const contactEmail = (body.contactEmail ?? '').trim();
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return NextResponse.json({ error: '邮箱格式不正确' });
    }

    let classCode: string | null = null;
    let className: string | null = null;
    if (role === 'student' && body.classCode !== undefined) {
      const code = body.classCode.trim().toLowerCase();
      if (code) {
        className = CLASS_CODES[code] ?? null;
        if (!className) {
          const { data: cls } = await getAdminClient().from('classes').select('name').eq('invite_code', code).maybeSingle();
          className = (cls as { name: string } | null)?.name ?? null;
        }
        if (!className) return NextResponse.json({ error: '班级邀请码不正确' });
      }
      classCode = code || null;
    }

    const studentNo = role === 'student' && body.studentNo !== undefined ? body.studentNo.trim() : null;
    if (studentNo !== null && !studentNo) return NextResponse.json({ error: '学号不能为空' });

    const metadata: Record<string, unknown> = { ...meta };
    if (contactEmail) metadata.contact_email = contactEmail;
    if (role === 'student' && body.classCode !== undefined) {
      metadata.class_code = classCode;
      metadata.class_name = className;
    }
    const admin = getAdminClient();
    // 元数据写入走 service_role：userClient 以 persistSession:false 创建，storage 无 session，
    // supabase-js 的 updateUser 会必然抛 AuthSessionMissingError（_getUser 有自定义 Authorization
    // 豁免分支而 _updateUser 没有）。调用方身份已由上方 getUser 核验
    const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    if (metaErr) return NextResponse.json({ error: '保存失败：' + metaErr.message });

    const patch: Record<string, unknown> = {};
    if (studentNo !== null) patch.student_no = studentNo;
    if (contactEmail) patch.contact_email = contactEmail;
    if (role === 'student' && body.classCode !== undefined) {
      patch.class_code = classCode;
      patch.class_name = className;
    }
    if (Object.keys(patch).length > 0) {
      const { error: profErr } = await admin.from('profiles').update(patch).eq('id', user.id);
      if (profErr) return NextResponse.json({ error: '保存失败：' + profErr.message });
    }
    invalidateSessionCache(token);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
}
