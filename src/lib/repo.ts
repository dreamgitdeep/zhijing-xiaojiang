import { loadPlantsForServer } from '@/lib/data';
import { getAdminClient, getUserClient, isCloudConfigured } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/auth';
import { EMAIL_DOMAIN } from '@/lib/auth-service';
import type { MasteryInfo } from '@/lib/mastery';
import { computeAllMastery, computeMasteryForUser, fetchMasteryRows } from '@/lib/mastery-service';

export type RepoMode = 'cloud' | 'local';

export function currentMode(): RepoMode {
  return isCloudConfigured() ? 'cloud' : 'local';
}

export interface MasteryState {
  items: Map<string, MasteryInfo>;
}

export interface StudentRow {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  role: string;
  mastered: number;
  attempts: number;
  avgScore: number | null;
  lastActiveAt: string | null;
}

export async function getMastery(): Promise<MasteryState> {
  const auth = await getAuthContext();
  if (!auth) return { items: new Map() };

  const [results, statRows] = await Promise.all([
    computeMasteryForUser(auth.userId),
    fetchMasteryRows(auth.userId),
  ]);

  const items = new Map<string, MasteryInfo>();
  for (const [plantId, result] of results) {
    const row = statRows.get(`${auth.userId}:${plantId}`);
    items.set(plantId, {
      bestScore: row?.best_score ?? 0,
      attempts: row?.attempts ?? 0,
      mastered: result.mastered,
      manual: row?.manual ?? false,
      updatedAt: row?.updated_at ?? null,
      correctedCount: result.correctedCount,
      totalCount: result.totalCount,
      pendingQuestionIds: result.pendingQuestionIds,
    });
  }
  return { items };
}

export async function mergeLocalMastery(
  items: { plantId: string; bestScore: number; attempts: number; mastered: boolean; manual: boolean; updatedAt: string | null }[],
): Promise<number> {
  const auth = await getAuthContext();
  if (!auth || items.length === 0) return 0;

  const client = getUserClient(auth.token);
  const { data: rows, error } = await client
    .from('mastery')
    .select('plant_id, best_score, attempts, mastered, manual, updated_at')
    .eq('user_id', auth.userId);
  if (error) throw new Error(`读取掌握数据失败：${error.message}`);

  const existing = new Map<string, (typeof rows)[number]>();
  for (const row of rows ?? []) existing.set(row.plant_id, row);

  const upserts: Record<string, unknown>[] = [];
  for (const item of items) {
    const prev = existing.get(item.plantId);
    if (prev) {
      const merged = {
        user_id: auth.userId,
        plant_id: item.plantId,
        best_score: Math.max(prev.best_score, item.bestScore),
        attempts: Math.max(prev.attempts, item.attempts),
        mastered: prev.mastered || item.mastered,
        manual: prev.manual || item.manual,
        updated_at: prev.updated_at,
      };
      if (
        merged.best_score !== prev.best_score ||
        merged.attempts !== prev.attempts ||
        merged.mastered !== prev.mastered ||
        merged.manual !== prev.manual
      ) {
        upserts.push(merged);
      }
    } else if (item.bestScore > 0 || item.attempts > 0 || item.mastered) {
      upserts.push({
        user_id: auth.userId,
        plant_id: item.plantId,
        best_score: item.bestScore,
        attempts: item.attempts,
        mastered: item.mastered,
        manual: item.manual,
        updated_at: item.updatedAt,
      });
    }
  }

  let merged = 0;
  for (let i = 0; i < upserts.length; i += 50) {
    const batch = upserts.slice(i, i + 50);
    const { error: upsertError } = await client
      .from('mastery')
      .upsert(batch, { onConflict: 'user_id,plant_id' });
    if (upsertError) throw new Error(`合并本地进度失败：${upsertError.message}`);
    merged += batch.length;
  }
  return merged;
}

export interface TeacherStats {
  studentTotal: number;
  activeRecent: number;
  avgMastered: number;
  attemptTotal: number;
  byClass: { className: string; avgMastered: number; students: number }[];
  recentActivity: { name: string; plantName: string; score: number; total: number; createdAt: string }[];
}

export async function getTeacherStats(): Promise<TeacherStats> {
  const admin = getAdminClient();
  const [{ data: profiles }, attempts, { byUser }] = await Promise.all([
    admin.from('profiles').select('id, name, student_no, class_name, role'),
    fetchAllAttemptsForStats(admin),
    computeAllMastery(),
  ]);

  const students = (profiles ?? []).filter(p => p.role === 'student');
  const masteredByUser = new Map<string, number>();
  for (const [userId, perPlant] of byUser) {
    let count = 0;
    for (const result of perPlant.values()) if (result.mastered) count += 1;
    if (count > 0) masteredByUser.set(userId, count);
  }

  const attemptTotal = attempts.length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const activeRecent = new Set<string>();
  for (const row of attempts) {
    if (new Date(row.created_at).getTime() >= sevenDaysAgo) activeRecent.add(row.user_id);
  }

  const classAgg = new Map<string, { sum: number; students: number }>();
  for (const s of students) {
    const m = masteredByUser.get(s.id) ?? 0;
    const key = s.class_name || '未分班';
    const agg = classAgg.get(key) ?? { sum: 0, students: 0 };
    agg.sum += m;
    agg.students += 1;
    classAgg.set(key, agg);
  }

  const plantNames = new Map((await loadPlantsForServer()).plants.map(p => [p.id, p.name]));

  return {
    studentTotal: students.length,
    activeRecent: activeRecent.size,
    avgMastered:
      students.length === 0
        ? 0
        : Math.round((students.reduce((acc, s) => acc + (masteredByUser.get(s.id) ?? 0), 0) / students.length) * 10) / 10,
    attemptTotal,
    byClass: [...classAgg.entries()]
      .map(([className, agg]) => ({
        className,
        avgMastered: Math.round((agg.sum / agg.students) * 10) / 10,
        students: agg.students,
      }))
      .sort((a, b) => b.avgMastered - a.avgMastered),
    recentActivity: [...attempts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8).map(row => ({
      name: (profiles ?? []).find(p => p.id === row.user_id)?.name ?? '未知学生',
      plantName: plantNames.get(row.plant_id) ?? row.plant_id,
      score: row.score,
      total: row.total,
      createdAt: row.created_at,
    })),
  };
}

async function fetchAllAttemptsForStats(admin: ReturnType<typeof getAdminClient>): Promise<{ user_id: string; plant_id: string; score: number; total: number; created_at: string }[]> {
  // 分页取全量：supabase-js 单次上限 1000 行，班级练习量大时隐式截断会少算练习统计
  const PAGE = 1000;
  const rows: { user_id: string; plant_id: string; score: number; total: number; created_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('quiz_attempts')
      .select('user_id, plant_id, score, total, created_at')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`读取练习记录失败：${error.message}`);
    rows.push(...((data ?? []) as { user_id: string; plant_id: string; score: number; total: number; created_at: string }[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

export async function getStudentRows(): Promise<StudentRow[]> {
  const admin = getAdminClient();
  const [{ data: profiles }, attempts, { byUser }] = await Promise.all([
    admin.from('profiles').select('id, name, student_no, class_name, role'),
    fetchAllAttemptsForStats(admin),
    computeAllMastery(),
  ]);

  const students = (profiles ?? []).filter(p => p.role === 'student');
  const masteredByUser = new Map<string, { count: number }>();
  for (const [userId, perPlant] of byUser) {
    let count = 0;
    for (const result of perPlant.values()) if (result.mastered) count += 1;
    if (count > 0) masteredByUser.set(userId, { count });
  }
  const attemptAgg = new Map<string, { count: number; scoreSum: number; totalSum: number; last: string }>();
  for (const row of attempts ?? []) {
    const prev = attemptAgg.get(row.user_id);
    attemptAgg.set(row.user_id, {
      count: (prev?.count ?? 0) + 1,
      scoreSum: (prev?.scoreSum ?? 0) + row.score,
      totalSum: (prev?.totalSum ?? 0) + row.total,
      last: !prev || row.created_at > prev.last ? row.created_at : prev.last,
    });
  }

  return students
    .map(s => {
      const m = masteredByUser.get(s.id);
      const a = attemptAgg.get(s.id);
      const lastActive = a?.last ?? null;
      return {
        userId: s.id,
        name: s.name,
        studentNo: s.student_no ?? '',
        className: s.class_name ?? '',
        role: s.role,
        mastered: m?.count ?? 0,
        attempts: a?.count ?? 0,
        avgScore: a && a.totalSum > 0 ? Math.round((a.scoreSum / a.totalSum) * 100) : null,
        lastActiveAt: lastActive,
      };
    })
    .sort((a, b) => b.mastered - a.mastered || a.name.localeCompare(b.name, 'zh'));
}

export async function upsertPlant(plant: Record<string, unknown>, id: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('plants')
    .upsert({ id, data: plant, name: plant.name, category: plant.category, layer: plant.layer, is_warning: Boolean(plant.isWarning), restriction: plant.isWarning ? (plant.warning as { restriction?: string } | null)?.restriction ?? null : null, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(`保存植物失败：${error.message}`);
}

export async function deletePlant(id: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('plants').delete().eq('id', id);
  if (error) throw new Error(`删除植物失败：${error.message}`);
}

export async function listPlants(): Promise<{ id: string; name: string; category: string; layer: string; warning: string | null; data: Record<string, unknown>; updated_at: string }[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('plants')
    .select('id, name, category, layer, restriction, data, updated_at')
    .order('id');
  if (error) throw new Error(`读取植物失败：${error.message}`);
  return (data ?? []).map((r) => ({ ...r, warning: r.restriction }));
}

export async function importPlants(
  plants: { id: string; data: Record<string, unknown> }[],
): Promise<{ imported: number; skipped: number }> {
  const admin = getAdminClient();
  let imported = 0;
  let skipped = 0;
  for (const item of plants) {
    const { data: existing } = await admin
      .from('plants')
      .select('id')
      .eq('id', item.id)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await admin.from('plants').insert({
      id: item.id,
      data: item.data,
      name: item.data.name as string,
      category: item.data.category as string,
      layer: item.data.layer as string,
      is_warning: Boolean(item.data.isWarning),
      restriction: item.data.isWarning
        ? ((item.data.warning as { restriction?: string } | null)?.restriction ?? null)
        : null,
    });
    if (error) throw new Error(`导入 ${item.id} 失败：${error.message}`);
    imported += 1;
  }
  return { imported, skipped };
}

export function resolveImageUrl(path: unknown): string {
  if (typeof path !== "string" || !path) return "";
  if (path.startsWith("plant-images/")) {
    const base = process.env.COZE_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/${path}` : path;
  }
  return path;
}

export interface ClassComparison {
  className: string;
  studentCount: number;
  avgMastered: number;
}

export async function getClassComparison(): Promise<ClassComparison[]> {
  const admin = getAdminClient();
  const [{ data: students }, { byUser }] = await Promise.all([
    admin.from('profiles').select('id, class_name').eq('role', 'student'),
    computeAllMastery(),
  ]);
  const masteredByUser = new Map<string, number>();
  for (const [userId, perPlant] of byUser) {
    let count = 0;
    for (const result of perPlant.values()) if (result.mastered) count += 1;
    if (count > 0) masteredByUser.set(userId, count);
  }
  const byClass = new Map<string, { students: number; total: number }>();
  for (const s of students ?? []) {
    const key = s.class_name || '未分班';
    const entry = byClass.get(key) ?? { students: 0, total: 0 };
    entry.students += 1;
    entry.total += masteredByUser.get(s.id) ?? 0;
    byClass.set(key, entry);
  }
  return [...byClass.entries()].map(([className, v]) => ({
    className,
    studentCount: v.students,
    avgMastered: v.students ? Math.round((v.total / v.students) * 10) / 10 : 0,
  }));
}

export interface HardPlant {
  plantId: string;
  name: string;
  attempts: number;
  avgScoreRatio: number;
}

export async function getHardPlants(): Promise<HardPlant[]> {
  const admin = getAdminClient();
  const attempts = await fetchAllAttemptsForStats(admin);
  if (!attempts.length) return [];
  const byPlant = new Map<string, { total: number; score: number }>();
  for (const a of attempts) {
    if (typeof a.total !== 'number' || !a.total) continue;
    const entry = byPlant.get(a.plant_id) ?? { total: 0, score: 0 };
    entry.total += 1;
    entry.score += a.score / a.total;
    byPlant.set(a.plant_id, entry);
  }
  const ids = [...byPlant.keys()];
  if (!ids.length) return [];
  const { data: plants } = await admin.from('plants').select('id, name').in('id', ids);
  const nameById = new Map((plants ?? []).map((p) => [p.id, p.name]));
  return [...byPlant.entries()]
    .map(([plantId, v]) => ({
      plantId,
      name: nameById.get(plantId) ?? plantId,
      attempts: v.total,
      avgScoreRatio: Math.round((v.score / v.total) * 100) / 100,
    }))
    .sort((a, b) => a.avgScoreRatio - b.avgScoreRatio)
    .slice(0, 8);
}

export interface StudentDetailData {
  plantGrid: { plantId: string; name: string; mastered: boolean; manual: boolean; bestScore: number }[];
  recentAttempts: { id: number; plantId: string; plantName: string; score: number; total: number; createdAt: string }[];
}

export async function getStudentDetail(userId: string): Promise<StudentDetailData> {
  const admin = getAdminClient();
  const [{ data: attempts }, results, statRows] = await Promise.all([
    admin.from('quiz_attempts').select('id, plant_id, score, total, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    computeMasteryForUser(userId),
    fetchMasteryRows(userId),
  ]);
  const plantIds = [...new Set([...results.keys(), ...(attempts ?? []).map((a) => a.plant_id)])];
  let nameById = new Map<string, string>();
  if (plantIds.length) {
    const { data: plants } = await admin.from('plants').select('id, name').in('id', plantIds);
    nameById = new Map((plants ?? []).map((p) => [p.id, p.name]));
  }
  return {
    plantGrid: [...results.entries()].map(([plantId, result]) => {
      const row = statRows.get(`${userId}:${plantId}`);
      return {
        plantId,
        name: nameById.get(plantId) ?? plantId,
        mastered: result.mastered,
        manual: row?.manual ?? false,
        bestScore: row?.best_score ?? 0,
      };
    }),
    recentAttempts: (attempts ?? []).map((a) => ({
      id: a.id,
      plantId: a.plant_id,
      plantName: nameById.get(a.plant_id) ?? a.plant_id,
      score: a.score,
      total: a.total,
      createdAt: a.created_at,
    })),
  };
}

export interface LearningPlant {
  plantId: string;
  name: string;
  thumb: string;
  bestScore: number;
  /** 该植物当前题目总数（动态，教师可增删题） */
  total: number;
}

/** 逐株正确率（quiz_attempts 历史聚合）+ 掌握状态（唯一入口 computeMastery） */
export interface LearningPlantAccuracy {
  plantId: string;
  name: string;
  thumb: string;
  /** 正确率 0-100 整数 = Σscore / Σtotal（该植物全部练习记录聚合） */
  accuracy: number;
  /** 该植物练习次数（quiz_attempts 行数） */
  attempts: number;
  /** 掌握状态，沿用 computeMastery 判定，不另算口径 */
  mastered: boolean;
}

export interface LearningDashboard {
  stats: { mastered: number; practiced: number; totalAttempts: number; avgAccuracy: number; chatCount: number };
  trend: { date: string; count: number }[];
  masteredPlants: LearningPlant[];
  inProgress: LearningPlant[];
  recentAttempts: { id: number; plantId: string; plantName: string; score: number; total: number; createdAt: string }[];
  plantAccuracy: LearningPlantAccuracy[];
}

export function emptyLearningDashboard(): LearningDashboard {
  const trend: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    trend.push({ date: `${d.getMonth() + 1}-${d.getDate()}`, count: 0 });
  }
  return {
    stats: { mastered: 0, practiced: 0, totalAttempts: 0, avgAccuracy: 0, chatCount: 0 },
    trend,
    masteredPlants: [],
    inProgress: [],
    recentAttempts: [],
    plantAccuracy: [],
  };
}

export async function getLearningDashboard(userId: string): Promise<LearningDashboard> {
  const admin = getAdminClient();
  const [{ data: attempts }, { count: chatCount }, results, statRows] = await Promise.all([
    admin.from('quiz_attempts').select('id, plant_id, score, total, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    computeMasteryForUser(userId),
    fetchMasteryRows(userId),
  ]);

  const dash = emptyLearningDashboard();
  const atts = attempts ?? [];
  const plantIds = [...results.keys()];
  let nameById = new Map<string, string>();
  if (plantIds.length) {
    const { data: plants } = await admin.from('plants').select('id, name').in('id', plantIds);
    nameById = new Map((plants ?? []).map((p) => [p.id, p.name]));
  }

  const bestOf = (plantId: string) => statRows.get(`${userId}:${plantId}`)?.best_score ?? 0;
  const toPlant = (plantId: string): LearningPlant => ({
    plantId,
    name: nameById.get(plantId) ?? plantId,
    thumb: `/images/plants/thumbs/${plantId}.webp`,
    bestScore: bestOf(plantId),
    total: results.get(plantId)?.totalCount ?? 0,
  });
  const entries = [...results.entries()];
  dash.masteredPlants = entries
    .filter(([, r]) => r.mastered)
    .sort((a, b) => bestOf(b[0]) - bestOf(a[0]))
    .map(([plantId]) => toPlant(plantId));
  dash.inProgress = entries
    .filter(([, r]) => !r.mastered)
    .sort((a, b) => bestOf(b[0]) - bestOf(a[0]))
    .map(([plantId]) => toPlant(plantId));

  dash.stats.mastered = dash.masteredPlants.length;
  dash.stats.practiced = dash.inProgress.length;
  dash.stats.totalAttempts = atts.length;
  dash.stats.avgAccuracy = atts.length
    ? Math.round((atts.reduce((s, a) => s + a.score / Math.max(a.total, 1), 0) / atts.length) * 100)
    : 0;
  dash.stats.chatCount = chatCount ?? 0;

  for (const day of dash.trend) {
    day.count = 0;
  }
  for (const a of atts) {
    const d = new Date(a.created_at);
    const key = `${d.getMonth() + 1}-${d.getDate()}`;
    const day = dash.trend.find((t) => t.date === key);
    if (day) day.count++;
  }

  dash.recentAttempts = atts.slice(0, 10).map((a) => ({
    id: a.id,
    plantId: a.plant_id,
    plantName: nameById.get(a.plant_id) ?? a.plant_id,
    score: a.score,
    total: a.total,
    createdAt: a.created_at,
  }));

  // 逐株正确率：quiz_attempts 历史聚合（Σscore/Σtotal），掌握状态取 computeMastery 结果（同口径）
  const accByPlant = new Map<string, { score: number; total: number; attempts: number }>();
  for (const a of atts) {
    const cur = accByPlant.get(a.plant_id) ?? { score: 0, total: 0, attempts: 0 };
    cur.score += a.score;
    cur.total += a.total;
    cur.attempts += 1;
    accByPlant.set(a.plant_id, cur);
  }
  dash.plantAccuracy = [...accByPlant.entries()].map(([plantId, v]) => ({
    plantId,
    name: nameById.get(plantId) ?? plantId,
    thumb: `/images/plants/thumbs/${plantId}.webp`,
    accuracy: v.total > 0 ? Math.round((v.score / v.total) * 100) : 0,
    attempts: v.attempts,
    mastered: results.get(plantId)?.mastered ?? false,
  }));

  return dash;
}

// ============ 班级管理 ============
export interface ClassRow {
  id: string;
  name: string;
  inviteCode: string;
  students: number;
}

export async function listClasses(): Promise<ClassRow[]> {
  if (!isCloudConfigured()) return [];
  const admin = getAdminClient();
  const [{ data: cls }, { data: profs }] = await Promise.all([
    admin.from('classes').select('id, name, invite_code').order('created_at'),
    admin.from('profiles').select('class_name').eq('role', 'student'),
  ]);
  const counts = new Map<string, number>();
  for (const p of (profs ?? []) as { class_name: string | null }[]) {
    const k = p.class_name || '';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return ((cls ?? []) as { id: string; name: string; invite_code: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
    inviteCode: c.invite_code,
    students: counts.get(c.name) ?? 0,
  }));
}

export async function createClass(name: string): Promise<{ ok?: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: '请输入班级名称' };
  if (trimmed.length > 20) return { error: '班级名称过长（最多 20 字）' };
  const admin = getAdminClient();
  const { data: exists } = await admin.from('classes').select('id').eq('name', trimmed).maybeSingle();
  if (exists) return { error: '该班级已存在' };
  let code = '';
  for (let i = 0; i < 6; i++) {
    code = 'c' + Math.random().toString(36).slice(2, 8);
    const { data: dup } = await admin.from('classes').select('id').eq('invite_code', code).maybeSingle();
    if (!dup) break;
  }
  const { error } = await admin.from('classes').insert({
    id: `cls-${Math.random().toString(36).slice(2, 10)}`,
    name: trimmed,
    invite_code: code,
  });
  if (error) return { error: `创建失败：${error.message}` };
  return { ok: true };
}

export async function deleteClass(classId: string): Promise<{ ok?: boolean; unassigned?: number; error?: string }> {
  const admin = getAdminClient();
  const { data: cls } = await admin.from('classes').select('id, name, invite_code').eq('id', classId).maybeSingle();
  if (!cls) return { error: '班级不存在' };
  const { data: members } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .eq('class_code', cls.invite_code);
  const memberIds = ((members ?? []) as { id: string }[]).map((m) => m.id);
  if (memberIds.length) {
    const { error } = await admin.from('profiles').update({ class_name: null, class_code: null }).in('id', memberIds);
    if (error) return { error: `解除学生分班失败：${error.message}` };
  }
  const { data: tasks } = await admin
    .from('design_tasks')
    .select('id, published_classes')
    .contains('published_classes', [cls.invite_code]);
  for (const t of (tasks ?? []) as { id: string; published_classes: string[] | null }[]) {
    const codes = (t.published_classes ?? []).filter((c) => c !== cls.invite_code);
    await admin.from('design_tasks').update({ published_classes: codes }).eq('id', t.id);
  }
  const { error } = await admin.from('classes').delete().eq('id', classId);
  if (error) return { error: `删除失败：${error.message}` };
  return { ok: true, unassigned: memberIds.length };
}

export interface RosterRow {
  studentNo: string;
  name: string;
}

export interface RosterResult {
  added: number;
  moved: number;
  skipped: number;
  failed: number;
}

export async function importRoster(classId: string, rows: RosterRow[]): Promise<RosterResult | { error: string }> {
  const admin = getAdminClient();
  const { data: cls } = await admin.from('classes').select('id, name, invite_code').eq('id', classId).maybeSingle();
  if (!cls) return { error: '班级不存在' };
  const { data: profs } = await admin.from('profiles').select('id, student_no, class_name').eq('role', 'student');
  const byNo = new Map<string, { id: string; class_name: string | null }>(
    ((profs ?? []) as { id: string; student_no: string | null; class_name: string | null }[])
      .filter((p) => p.student_no)
      .map((p) => [p.student_no as string, { id: p.id, class_name: p.class_name }]),
  );
  const res: RosterResult = { added: 0, moved: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    const existing = byNo.get(row.studentNo);
    if (existing) {
      if (existing.class_name === cls.name) {
        res.skipped++;
        continue;
      }
      const { error } = await admin.from('profiles').update({ class_name: cls.name, class_code: cls.invite_code }).eq('id', existing.id);
      if (error) {
        res.failed++;
        continue;
      }
      const { data: existingUser } = await admin.auth.admin.getUserById(existing.id);
      const existingMeta = ((existingUser?.user?.user_metadata ?? {}) as Record<string, unknown>);
      await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...existingMeta, class_code: cls.invite_code, class_name: cls.name },
      });
      res.moved++;
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: `${row.studentNo.toLowerCase()}@${EMAIL_DOMAIN}`,
        password: row.studentNo.slice(-6),
        email_confirm: true,
        user_metadata: {
          name: row.name,
          role: 'student',
          student_no: row.studentNo,
          class_name: cls.name,
          class_code: cls.invite_code,
          account: row.studentNo,
        },
      });
      if (error) {
        res.failed++;
        continue;
      }
      res.added++;
    }
  }
  return res;
}
