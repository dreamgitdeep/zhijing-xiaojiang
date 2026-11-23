import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getUserClient } from '@/lib/supabase-server';
import { computeMasteryForPlant } from '@/lib/mastery-service';
import { fetchMasteryRows } from '@/lib/mastery-service';

export const dynamic = 'force-dynamic';

interface SubmittedAnswer {
  qid: string;
  picked?: number;
  correct: boolean;
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plantId = body?.plantId;
  const score = Number(body?.score);
  const total = Number(body?.total);
  const rawAnswers = body?.answers;
  if (typeof plantId !== 'string' || !plantId || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: 'plantId/score/total 必填' }, { status: 400 });
  }
  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    return NextResponse.json({ error: 'answers 必填' }, { status: 400 });
  }
  // 新格式：逐题结果（qid + correct），掌握判定按题聚合历史；兼容旧客户端的数值数组
  const isNewFormat = rawAnswers.every(
    (a) => a !== null && typeof a === 'object' && typeof (a as SubmittedAnswer).qid === 'string',
  );
  const answers: unknown = isNewFormat
    ? (rawAnswers as SubmittedAnswer[]).map((a) => ({ qid: a.qid, correct: a.correct === true }))
    : rawAnswers.map(Number);

  const client = getUserClient(auth.token);
  const { error: attemptError } = await client.from('quiz_attempts').insert({
    user_id: auth.userId,
    plant_id: plantId,
    score,
    total,
    answers,
  });
  if (attemptError) return NextResponse.json({ error: attemptError.message }, { status: 500 });

  // 唯一判定入口：按题聚合全部历史（含本次），对照当前题库与配置阈值得出掌握结果
  const result = await computeMasteryForPlant(auth.userId, plantId);
  const statRows = await fetchMasteryRows(auth.userId);
  const existing = statRows.get(`${auth.userId}:${plantId}`);

  const row = {
    user_id: auth.userId,
    plant_id: plantId,
    best_score: Math.max(existing?.best_score ?? 0, score),
    attempts: (existing?.attempts ?? 0) + 1,
    mastered: existing?.manual ? (existing?.mastered ?? false) : result.mastered,
    manual: existing?.manual ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error: masteryError } = await client
    .from('mastery')
    .upsert(row, { onConflict: 'user_id,plant_id' });
  if (masteryError) return NextResponse.json({ error: masteryError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mastered: row.mastered,
    correctedCount: result.correctedCount,
    totalCount: result.totalCount,
    passRatio: result.passRatio,
    pendingCount: result.pendingQuestionIds.length,
    pendingQuestionIds: result.pendingQuestionIds,
  });
}
