import { getAdminClient } from '@/lib/supabase-server';
import type { QuizQuestion } from './types';
import {
  computeMastery,
  ensureQuizQids,
  type AttemptLike,
  type MasteryResult,
} from './mastery-engine';
import { getMasteryPassRatio } from './settings';

/**
 * 掌握判定服务端数据装配（唯一聚合链路的取数层）。
 * 判定逻辑本身在 mastery-engine 纯函数中，此处只负责取数与组装。
 */

interface MasteryTableRow {
  user_id: string;
  plant_id: string;
  mastered: boolean;
  best_score: number;
  attempts: number;
  manual: boolean;
  updated_at: string | null;
}

export interface PlantQuizRef {
  quiz: QuizQuestion[];
}

export async function fetchPlantQuizzes(): Promise<Map<string, QuizQuestion[]>> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('plants').select('id, data');
  if (error) throw new Error(`读取植物题库失败：${error.message}`);
  const map = new Map<string, QuizQuestion[]>();
  for (const row of (data ?? []) as { id: string; data: { quiz?: QuizQuestion[] } }[]) {
    const plant = ensureQuizQids({ id: row.id, quiz: Array.isArray(row.data?.quiz) ? row.data.quiz : [] });
    map.set(row.id, plant.quiz ?? []);
  }
  return map;
}

export async function fetchAttemptsForUser(userId: string): Promise<Map<string, AttemptLike[]>> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('quiz_attempts')
    .select('plant_id, score, total, answers')
    .eq('user_id', userId);
  if (error) throw new Error(`读取练习记录失败：${error.message}`);
  return groupAttempts((data ?? []) as (AttemptLike & { plant_id: string })[]);
}

export async function fetchAllAttempts(): Promise<Map<string, Map<string, AttemptLike[]>>> {
  const admin = getAdminClient();
  // 分页取全量：supabase-js 单次上限 1000 行，班级练习量大时隐式截断会漏算掌握
  const PAGE = 1000;
  const rows: (AttemptLike & { user_id: string; plant_id: string })[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('quiz_attempts')
      .select('user_id, plant_id, score, total, answers')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`读取练习记录失败：${error.message}`);
    rows.push(...((data ?? []) as (AttemptLike & { user_id: string; plant_id: string })[]));
    if ((data ?? []).length < PAGE) break;
  }
  const byUser = new Map<string, Map<string, AttemptLike[]>>();
  for (const row of rows) {
    let byPlant = byUser.get(row.user_id);
    if (!byPlant) {
      byPlant = new Map();
      byUser.set(row.user_id, byPlant);
    }
    const list = byPlant.get(row.plant_id) ?? [];
    list.push(row);
    byPlant.set(row.plant_id, list);
  }
  return byUser;
}

function groupAttempts(rows: (AttemptLike & { plant_id: string })[]): Map<string, AttemptLike[]> {
  const map = new Map<string, AttemptLike[]>();
  for (const row of rows) {
    const list = map.get(row.plant_id) ?? [];
    list.push(row);
    map.set(row.plant_id, list);
  }
  return map;
}

export async function fetchMasteryRows(userId?: string): Promise<Map<string, MasteryTableRow>> {
  const admin = getAdminClient();
  let query = admin.from('mastery').select('user_id, plant_id, mastered, best_score, attempts, manual, updated_at');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw new Error(`读取掌握数据失败：${error.message}`);
  const map = new Map<string, MasteryTableRow>();
  for (const row of (data ?? []) as MasteryTableRow[]) {
    map.set(`${row.user_id}:${row.plant_id}`, row);
  }
  return map;
}

/** 单学生单植物判定（答题结算用） */
export async function computeMasteryForPlant(userId: string, plantId: string): Promise<MasteryResult> {
  const [passRatio, quizzes, attemptsByPlant, masteryRows] = await Promise.all([
    getMasteryPassRatio(),
    fetchPlantQuizzes(),
    fetchAttemptsForUser(userId),
    fetchMasteryRows(userId),
  ]);
  const row = masteryRows.get(`${userId}:${plantId}`);
  return computeMastery({
    attempts: attemptsByPlant.get(plantId) ?? [],
    quiz: quizzes.get(plantId) ?? [],
    passRatio,
    manual: row?.manual ?? false,
    manualMastered: row?.mastered ?? false,
  });
}

/** 单学生全部植物判定（图鉴徽章 / 学习管理 / 练习页用） */
export async function computeMasteryForUser(userId: string): Promise<Map<string, MasteryResult>> {
  const [passRatio, quizzes, attemptsByPlant, masteryRows] = await Promise.all([
    getMasteryPassRatio(),
    fetchPlantQuizzes(),
    fetchAttemptsForUser(userId),
    fetchMasteryRows(userId),
  ]);
  const plantIds = new Set<string>([...attemptsByPlant.keys()]);
  for (const key of masteryRows.keys()) plantIds.add(key.split(':')[1]);
  const results = new Map<string, MasteryResult>();
  for (const plantId of plantIds) {
    const row = masteryRows.get(`${userId}:${plantId}`);
    results.set(
      plantId,
      computeMastery({
        attempts: attemptsByPlant.get(plantId) ?? [],
        quiz: quizzes.get(plantId) ?? [],
        passRatio,
        manual: row?.manual ?? false,
        manualMastered: row?.mastered ?? false,
      }),
    );
  }
  return results;
}

/** 全体学生判定（教师统计 / 学情看板用） */
export async function computeAllMastery(): Promise<{
  passRatio: number;
  byUser: Map<string, Map<string, MasteryResult>>;
  rows: Map<string, MasteryTableRow>;
}> {
  const [passRatio, quizzes, attemptsByUser, masteryRows] = await Promise.all([
    getMasteryPassRatio(),
    fetchPlantQuizzes(),
    fetchAllAttempts(),
    fetchMasteryRows(),
  ]);
  const byUser = new Map<string, Map<string, MasteryResult>>();
  const userIds = new Set<string>([...attemptsByUser.keys()]);
  for (const key of masteryRows.keys()) userIds.add(key.split(':')[0]);
  for (const userId of userIds) {
    const attemptsByPlant = attemptsByUser.get(userId) ?? new Map();
    const plantIds = new Set<string>([...attemptsByPlant.keys()]);
    for (const key of masteryRows.keys()) {
      if (key.startsWith(`${userId}:`)) plantIds.add(key.split(':')[1]);
    }
    const perPlant = new Map<string, MasteryResult>();
    for (const plantId of plantIds) {
      const row = masteryRows.get(`${userId}:${plantId}`);
      perPlant.set(
        plantId,
        computeMastery({
          attempts: attemptsByPlant.get(plantId) ?? [],
          quiz: quizzes.get(plantId) ?? [],
          passRatio,
          manual: row?.manual ?? false,
          manualMastered: row?.mastered ?? false,
        }),
      );
    }
    byUser.set(userId, perPlant);
  }
  return { passRatio, byUser, rows: masteryRows };
}
