/**
 * 演示数据种子（幂等）：景观2301 班 158 名学生 + 练习/掌握/问答学情数据。
 * 两个入口共用：
 * - 服务启动后异步调用（server.ts），生产环境首次启动自动补数据；
 * - 手动运行 scripts/seed_demo_data.ts。
 * 幂等策略：158 个学号已全部就位时跳过班级/名单同步（避免复活教师已删除的班级）；
 * 学情生成按学生逐个判断，已有练习记录者跳过。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_DOMAIN } from './auth-constants';
import { getAdminClient, isCloudConfigured } from './supabase-server';

const CLASS_NAME = '景观2301';
const CLASS_CODE = 'jg2301';
const STUDENT_COUNT = 158;
const BASE_NO = 20232001000; // 学号 20232001001..20232001158
const SEED = 20260421;

const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('');
const GIVEN_CHARS = '伟芳敏静丽强磊军洋勇艳杰娟涛明超秀兰霞平刚桂英华玉萍红娥玲芬彬斌宇浩凯欣怡佳琪萌阳晨旭晗熙宁雪琳晶瑶蕾洁颖露倩茜妍彤蕊歆悦晴岚澜帆航毅俊泽翔鹏旭恒建忠学文思哲睿知行远清嘉乐安然'.split('');

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const ri = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

function buildRoster(): { studentNo: string; name: string }[] {
  const used = new Set<string>();
  const rows: { studentNo: string; name: string }[] = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const no = String(BASE_NO + i);
    let name = '';
    for (let tries = 0; tries < 50; tries++) {
      const s = SURNAMES[ri(0, SURNAMES.length - 1)];
      const g1 = GIVEN_CHARS[ri(0, GIVEN_CHARS.length - 1)];
      const g2 = rnd() < 0.62 ? GIVEN_CHARS[ri(0, GIVEN_CHARS.length - 1)] : '';
      name = s + g1 + g2;
      if (!used.has(name)) break;
    }
    used.add(name);
    rows.push({ studentNo: no, name: no === '20232001027' ? '秋千' : name });
  }
  return rows;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function ensureClasses(admin: SupabaseClient) {
  const seeds = [
    { id: 'cls-jg2301', name: '景观2301', invite_code: 'jg2301' },
    { id: 'cls-jg2302', name: '景观2302', invite_code: 'jg2302' },
    { id: 'cls-jg2303', name: '景观2303', invite_code: 'jg2303' },
  ];
  const { data: existing } = await admin.from('classes').select('id');
  const ids = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const missing = seeds.filter((s) => !ids.has(s.id));
  if (missing.length) {
    const { error } = await admin.from('classes').insert(missing);
    if (error) throw new Error(`班级初始化失败：${error.message}`);
  }
}

interface ProfileLite { id: string; student_no: string | null; class_code: string | null }

async function syncRoster(admin: SupabaseClient, roster: { studentNo: string; name: string }[]) {
  const { data: profs, error } = await admin.from('profiles').select('id, student_no, class_code').eq('role', 'student');
  if (error) throw new Error(`读取学生失败：${error.message}`);
  const byNo = new Map<string, ProfileLite>();
  for (const p of (profs ?? []) as ProfileLite[]) if (p.student_no) byNo.set(p.student_no, p);

  let added = 0, moved = 0, skipped = 0, failed = 0;
  for (const row of roster) {
    const existing = byNo.get(row.studentNo);
    if (existing) {
      if (existing.class_code === CLASS_CODE) { skipped++; continue; }
      const { error: e1 } = await admin.from('profiles')
        .update({ class_name: CLASS_NAME, class_code: CLASS_CODE })
        .eq('id', existing.id);
      if (e1) { failed++; continue; }
      const { data: u } = await admin.auth.admin.getUserById(existing.id);
      const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
      await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...meta, class_code: CLASS_CODE, class_name: CLASS_NAME },
      });
      moved++;
      continue;
    }
    const { error: e2 } = await admin.auth.admin.createUser({
      email: `${row.studentNo.toLowerCase()}@${EMAIL_DOMAIN}`,
      password: row.studentNo.slice(-6),
      email_confirm: true,
      user_metadata: {
        name: row.name,
        role: 'student',
        student_no: row.studentNo,
        class_name: CLASS_NAME,
        class_code: CLASS_CODE,
        account: row.studentNo,
        contact_email: `${row.studentNo}@example.com`,
      },
    });
    if (e2) { failed++; console.log(`[demo-seed] 创建失败 ${row.studentNo}: ${e2.message}`); continue; }
    added++;
    if (added % 20 === 0) console.log(`[demo-seed] 已创建 ${added} 个账号…`);
  }
  console.log(`[demo-seed] 名单同步：新增 ${added}，移入 ${moved}，已在班 ${skipped}，失败 ${failed}`);
}

interface AttemptRow { user_id: string; plant_id: string; score: number; total: number; answers: null; created_at: string }
interface MasteryRow { user_id: string; plant_id: string; mastered: boolean; best_score: number; attempts: number; manual: boolean; updated_at: string }
interface ChatRow { user_id: string; plant_id: string | null; role: string; content: string; created_at: string }

function tsAt(daysAgo: number, hour: number, minute: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  d.setHours(hour, minute, ri(0, 59), 0);
  return d.toISOString();
}

export async function ensureDemoData(): Promise<void> {
  if (!isCloudConfigured()) return;
  const admin = getAdminClient();
  const roster = buildRoster();
  const rosterNos = new Set(roster.map((r) => r.studentNo));

  // 名单完成标记：学号段已齐则跳过班级/名单同步，防止教师删班后被重启复活
  const { count, error: ce } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student')
    .like('student_no', '20232001%');
  if (ce) throw new Error(`读取名单标记失败：${ce.message}`);
  if ((count ?? 0) < STUDENT_COUNT) {
    await ensureClasses(admin);
    await syncRoster(admin, roster);
  } else {
    console.log('[demo-seed] 名单已就位，跳过班级/名单同步');
  }

  const { data: plantRows, error: pe } = await admin.from('plants').select('id, name, data');
  if (pe) throw new Error(`读取植物失败：${pe.message}`);
  const quizLen = new Map<string, number>();
  for (const p of (plantRows ?? []) as { id: string; data: { quiz?: unknown[] } }[]) {
    const n = Array.isArray(p.data?.quiz) ? p.data.quiz.length : 0;
    if (n > 0) quizLen.set(p.id, n);
  }
  const plantIds = [...quizLen.keys()];

  const { data: freshProfs, error: fe } = await admin.from('profiles').select('id, student_no, name').eq('role', 'student');
  if (fe) throw new Error(fe.message);
  const students = (freshProfs ?? []) as { id: string; student_no: string | null; name: string | null }[];

  // 分页取全量（supabase-js 单次上限 1000 行），用于判断哪些学生已有练习记录
  const attempted = new Set<string>();
  const attemptCountByUser = new Map<string, number>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: ae } = await admin
      .from('quiz_attempts').select('user_id').range(from, from + PAGE - 1);
    if (ae) throw new Error(`读取练习记录失败：${ae.message}`);
    for (const r of (page ?? []) as { user_id: string }[]) {
      attempted.add(r.user_id);
      attemptCountByUser.set(r.user_id, (attemptCountByUser.get(r.user_id) ?? 0) + 1);
    }
    if ((page ?? []).length < PAGE) break;
  }

  const attempts: AttemptRow[] = [];
  const masteryRows: MasteryRow[] = [];
  const chats: ChatRow[] = [];

  const genFor = (userId: string, masteredN: number, progressN: number, spanDays: number) => {
    const pool = shuffled(plantIds);
    const masteredSet = pool.slice(0, masteredN);
    const progressSet = pool.slice(masteredN, masteredN + progressN);
    const dayOf = () => {
      // 偏向近期：近 7 天权重更高
      const r = rnd();
      return r < 0.55 ? ri(0, Math.min(6, spanDays)) : ri(0, spanDays);
    };
    for (const pid of masteredSet) {
      const total = quizLen.get(pid)!;
      const startDay = Math.min(dayOf(), spanDays);
      const failFirst = rnd() < 0.55;
      let best = 0;
      let n = 0;
      if (failFirst) {
        const s = Math.max(1, Math.floor(total * (0.34 + rnd() * 0.5)));
        attempts.push({ user_id: userId, plant_id: pid, score: s, total, answers: null, created_at: tsAt(startDay, ri(8, 21), ri(0, 59)) });
        best = s; n = 1;
      }
      attempts.push({ user_id: userId, plant_id: pid, score: total, total, answers: null, created_at: tsAt(Math.max(0, startDay - ri(0, 2)), ri(8, 21), ri(0, 59)) });
      best = total; n += 1;
      masteryRows.push({ user_id: userId, plant_id: pid, mastered: true, best_score: best, attempts: n, manual: false, updated_at: tsAt(Math.max(0, startDay - 1), 20, 0) });
    }
    for (const pid of progressSet) {
      const total = quizLen.get(pid)!;
      const day = Math.min(dayOf(), spanDays);
      const n = ri(1, 2);
      let best = 0;
      for (let k = 0; k < n; k++) {
        const s = Math.max(0, Math.floor(total * (0.17 + rnd() * 0.6)));
        attempts.push({ user_id: userId, plant_id: pid, score: s, total, answers: null, created_at: tsAt(Math.max(0, day - k), ri(8, 21), ri(0, 59)) });
        best = Math.max(best, s);
      }
      masteryRows.push({ user_id: userId, plant_id: pid, mastered: false, best_score: best, attempts: n, manual: false, updated_at: tsAt(Math.max(0, day - n + 1), 20, 0) });
    }
  };

  let seeded = 0, skippedData = 0;
  for (const s of students) {
    if (!s.student_no || !rosterNos.has(s.student_no)) continue;
    const isStar = s.student_no === '20232001027';
    // 重点账号按需求追加数据（记录已足够多时也跳过）；其余已有练习记录的学生跳过，避免重复灌入
    if (attempted.has(s.id) && (!isStar || (attemptCountByUser.get(s.id) ?? 0) > 50)) {
      skippedData++;
      continue;
    }
    if (isStar) {
      // 重点账号：近 7 天每天都有练习，掌握面宽，问答活跃
      genFor(s.id, 48, 16, 20);
      const extra: AttemptRow[] = [];
      for (let d = 0; d <= 6; d++) {
        const n = ri(2, 4);
        for (let k = 0; k < n; k++) {
          const pid = plantIds[ri(0, plantIds.length - 1)];
          const total = quizLen.get(pid)!;
          const perfect = rnd() < 0.5;
          const score = perfect ? total : Math.max(0, Math.floor(total * (0.3 + rnd() * 0.55)));
          extra.push({ user_id: s.id, plant_id: pid, score, total, answers: null, created_at: tsAt(d, ri(8, 22), ri(0, 59)) });
        }
      }
      attempts.push(...extra);
      const topics = ['的观赏特性有哪些？', '在居住区造景中怎么应用？', '养护要点是什么？', '适合与哪些植物搭配？'];
      const chatPlants = shuffled(plantIds).slice(0, 8);
      const names = new Map(
        ((plantRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name] as [string, string]),
      );
      chatPlants.forEach((pid, i) => {
        const pname = names.get(pid) ?? pid;
        const day = ri(0, 6);
        const q = `请问${pname}${topics[i % topics.length]}`;
        const a = `## ${pname}\n\n**观赏特性**：${pname}是课程重点植物之一，叶形与季相变化具有代表性。\n\n**造景应用**：适合作为${['入口对植', '花境主景', '林缘背景', '庭院点植'][i % 4]}使用，注意与周边植物的层次搭配。\n\n**养护要点**：结合光照与水分条件管理，注意修剪时机。`;
        chats.push({ user_id: s.id, plant_id: pid, role: 'user', content: q, created_at: tsAt(day, ri(9, 20), ri(0, 59)) });
        chats.push({ user_id: s.id, plant_id: pid, role: 'assistant', content: a, created_at: tsAt(day, ri(9, 20), ri(0, 59) + 1) });
      });
      seeded++;
      continue;
    }
    const r = rnd();
    if (r < 0.26) genFor(s.id, ri(12, 32), ri(3, 8), 16);
    else if (r < 0.7) genFor(s.id, ri(4, 14), ri(0, 4), 24);
    else if (r < 0.9) genFor(s.id, ri(0, 3), ri(0, 2), 28);
    else continue; // 约 10% 学生暂无学习记录
    seeded++;
  }
  if (!seeded) {
    console.log(`[demo-seed] 学情已就位（跳过 ${skippedData} 名学生），无需生成`);
    return;
  }
  console.log(`[demo-seed] 学情生成：${seeded} 名学生（跳过已有记录 ${skippedData}）；练习 ${attempts.length} 条，掌握 ${masteryRows.length} 条，问答 ${chats.length} 条`);

  const chunk = async <T>(rows: T[], table: string, size = 500) => {
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + size));
      if (error) throw new Error(`写入 ${table} 失败：${error.message}`);
    }
  };
  attempts.sort((a, b) => a.created_at.localeCompare(b.created_at));
  chats.sort((a, b) => a.created_at.localeCompare(b.created_at));
  await chunk(attempts, 'quiz_attempts');
  const { error: me } = await admin.from('mastery').upsert(masteryRows, { onConflict: 'user_id,plant_id' });
  if (me) throw new Error(`写入 mastery 失败：${me.message}`);
  if (chats.length) await chunk(chats, 'chat_messages');
  console.log('[demo-seed] 完成');
}
