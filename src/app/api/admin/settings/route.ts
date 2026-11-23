import { NextResponse } from 'next/server';
import { requireUserToken } from '@/lib/auth';
import {
  getMasteryPassRatio,
  getRebaseReport,
  setMasteryPassRatio,
} from '@/lib/settings';

/**
 * 教学配置（当前仅「掌握判定 · 错题订正率」）。
 * 配置存 app_settings 表，仅教师可写；读取亦要求登录（教师端使用）。
 */

export async function GET() {
  try {
    await requireUserToken();
  } catch {
    return NextResponse.json({ ok: false, error: '未登录或会话已过期' }, { status: 401 });
  }
  const [passRatio, rebaseReport] = await Promise.all([getMasteryPassRatio(), getRebaseReport()]);
  return NextResponse.json({ ok: true, masteryPassRatio: passRatio, rebaseReport });
}

export async function PATCH(req: Request) {
  let user;
  try {
    ({ user } = await requireUserToken());
  } catch {
    return NextResponse.json({ ok: false, error: '未登录或会话已过期' }, { status: 401 });
  }
  if (user.role !== 'teacher') {
    return NextResponse.json({ ok: false, error: '仅教师可修改教学配置' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式错误' }, { status: 400 });
  }

  if (body.masteryPassRatio !== undefined) {
    const value = Number(body.masteryPassRatio);
    if (!Number.isFinite(value)) {
      return NextResponse.json({ ok: false, error: '错题订正率必须是数字（百分比，50–100）' }, { status: 400 });
    }
    const result = await setMasteryPassRatio(value, user.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  }

  const passRatio = await getMasteryPassRatio();
  return NextResponse.json({ ok: true, masteryPassRatio: passRatio });
}
