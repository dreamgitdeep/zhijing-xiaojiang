/**
 * 掌握判定口径重算（一次性迁移脚本，可重复执行）。
 *
 * 旧口径：单次练习答对固定题数即判掌握（硬编码）。
 * 新口径：错题订正制 —— 曾答对题数 / 当前题数 ≥ 配置订正率（默认 100%）。
 *
 * 本脚本按新口径从 quiz_attempts 历史逐题聚合，重写 mastery.mastered：
 * - 手工标记（manual=true）的行不参与重算；
 * - 历史全对但无题目级数据的旧记录，按「当时全部答对」折算计入当前题；
 * - 重算前后差异写入 app_settings(mastery_rebase_report)，供学情看板提示。
 *
 * 用法：pnpm tsx scripts/mastery_rebase.ts [--dry]
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client';
import {
  everCorrectQids,
  computeMasteryFromParts,
  ensureQuizQids,
  questionIds,
  DEFAULT_MASTERY_PASS_RATIO,
  type AttemptLike,
} from '../src/lib/mastery-engine';
import type { Plant, QuizQuestion } from '../src/lib/types';

const client = getSupabaseClient();
const DRY = process.argv.includes('--dry');

interface AttemptRow {
  user_id: string;
  plant_id: string;
  score: number | null;
  total: number | null;
  answers: unknown;
}

interface MasteryRow {
  user_id: string;
  plant_id: string;
  mastered: boolean;
  manual: boolean;
}

async function main() {
  const [{ data: attempts, error: e1 }, { data: masteryRows, error: e2 }, { data: plantRows, error: e3 }, { data: settingRow, error: e4 }] =
    await Promise.all([
      client.from('quiz_attempts').select('user_id, plant_id, score, total, answers'),
      client.from('mastery').select('user_id, plant_id, mastered, manual'),
      client.from('plants').select('id, data'),
      client.from('app_settings').select('value').eq('key', 'mastery_pass_ratio').maybeSingle(),
    ]);
  if (e1) throw new Error(`读取 quiz_attempts 失败: ${e1.message}`);
  if (e2) throw new Error(`读取 mastery 失败: ${e2.message}`);
  if (e3) throw new Error(`读取 plants 失败: ${e3.message}`);
  if (e4) throw new Error(`读取 app_settings 失败: ${e4.message}`);

  const rawRatio = settingRow?.value as unknown;
  const passRatio =
    typeof rawRatio === 'number' && Number.isFinite(rawRatio) && rawRatio >= 0.5 && rawRatio <= 1
      ? rawRatio
      : DEFAULT_MASTERY_PASS_RATIO;

  const quizByPlant = new Map<string, QuizQuestion[]>();
  for (const row of plantRows ?? []) {
    const plant = ensureQuizQids((row as { data: unknown }).data as Plant);
    quizByPlant.set((row as { id: string }).id, plant.quiz);
  }

  const attemptsByPair = new Map<string, AttemptRow[]>();
  for (const a of (attempts ?? []) as AttemptRow[]) {
    const key = `${a.user_id}:${a.plant_id}`;
    const list = attemptsByPair.get(key) ?? [];
    list.push(a);
    attemptsByPair.set(key, list);
  }

  const rows = (masteryRows ?? []) as MasteryRow[];
  const updates: { user_id: string; plant_id: string; mastered: boolean }[] = [];
  const changedStudents = new Set<string>();
  let changedPairs = 0;
  let demoted = 0;
  let promoted = 0;
  let skippedManual = 0;

  for (const row of rows) {
    if (row.manual) {
      skippedManual += 1;
      continue;
    }
    const quiz = quizByPlant.get(row.plant_id) ?? [];
    const history: AttemptLike[] = (attemptsByPair.get(`${row.user_id}:${row.plant_id}`) ?? []).map((a) => ({
      score: Number(a.score ?? 0),
      total: Number(a.total ?? 0),
      answers: a.answers,
    }));
    const ever = everCorrectQids(history, questionIds(quiz));
    const result = computeMasteryFromParts({ everCorrect: ever, quiz, passRatio });
    if (result.mastered !== row.mastered) {
      changedPairs += 1;
      changedStudents.add(row.user_id);
      if (row.mastered && !result.mastered) demoted += 1;
      else promoted += 1;
      updates.push({ user_id: row.user_id, plant_id: row.plant_id, mastered: result.mastered });
    }
  }

  console.log(`[rebase] passRatio=${passRatio} mastery行=${rows.length} 手工跳过=${skippedManual}`);
  console.log(`[rebase] 判定变化：${changedPairs} 条（${demoted} 条转未掌握 / ${promoted} 条转已掌握），涉及 ${changedStudents.size} 名学生`);

  if (DRY) {
    console.log('[rebase] dry-run，不写库');
    return;
  }

  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    const { error } = await client.from('mastery').upsert(batch, { onConflict: 'user_id,plant_id' });
    if (error) throw new Error(`更新 mastery 失败: ${error.message}`);
  }

  const report = {
    at: new Date().toISOString(),
    passRatio,
    changedStudents: changedStudents.size,
    changedPairs,
    demoted,
    promoted,
  };
  const { error: upsertError } = await client.from('app_settings').upsert(
    { key: 'mastery_rebase_report', value: report, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (upsertError) throw new Error(`写入重算报告失败: ${upsertError.message}`);
  console.log('[rebase] DONE，报告已写入 app_settings(mastery_rebase_report)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
