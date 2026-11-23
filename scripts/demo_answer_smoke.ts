/**
 * 演示答案链路冒烟（一次性）：
 * 建临时演示学生（学号 20232001027）→ 登录 → S1..S6 逐阶段 apply-demo → 校验进度/解锁/完成态；
 * 另建普通学生校验 403 守卫 → 清理全部测试数据。
 * 运行：pnpm tsx scripts/demo_answer_smoke.ts
 */
import { getSupabaseClient } from "../src/storage/database/supabase-client";

const BASE = "http://localhost:5000";
const ACCOUNT = "demotest01";
const EMAIL = `${ACCOUNT}@stu.zhijing.edu.cn`;
const PASSWORD = "Demo@Test-2026";
const OTHER_ACCOUNT = "demotest02";
const OTHER_EMAIL = `${OTHER_ACCOUNT}@stu.zhijing.edu.cn`;
const DEMO_STUDENT_NO = "20232001027";
const TASK_ID = "task-chuangzhi-01";
const STAGES = ["S1", "S2", "S3", "S4", "S5", "S6"];

async function login(account: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: account, password: PASSWORD }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const session = setCookie.split(";")[0];
  if (!session.startsWith("zj_session=")) throw new Error(`登录失败(${account}): ${await res.text()}`);
  return session;
}

async function main() {
  const admin = getSupabaseClient();

  // 1. 建临时演示学生（学号=演示账号；直连 admin signUp，仅测试用）
  const { data: su, error: suErr } = await admin.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: { data: { name: "演示冒烟生", role: "student", student_no: DEMO_STUDENT_NO, class_name: null, account: ACCOUNT, contact_email: "demo_test@test.local" } },
  });
  if (suErr) throw new Error(`注册失败: ${suErr.message}`);
  const userId = su.user!.id;
  console.log("demo student created:", userId);

  // 普通学生（其他学号，用于 403 守卫校验）
  const { data: su2, error: su2Err } = await admin.auth.signUp({
    email: OTHER_EMAIL,
    password: PASSWORD,
    options: { data: { name: "普通冒烟生", role: "student", student_no: "9999999999", class_name: null, account: OTHER_ACCOUNT, contact_email: "demo_test2@test.local" } },
  });
  if (su2Err) throw new Error(`注册失败2: ${su2Err.message}`);
  const otherUserId = su2.user!.id;

  let exitCode = 1;
  try {
    const session = await login(ACCOUNT);
    console.log("login ok");

    // 2. 未登录调用应 401
    const anon = await fetch(`${BASE}/api/design/stage/apply-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: TASK_ID, stageKey: "S1" }),
    });
    if (anon.status !== 401) throw new Error(`未登录守卫失效: ${anon.status}`);
    console.log("anon guard ok (401)");

    // 3. 非演示账号学生应 403
    const otherSession = await login(OTHER_ACCOUNT);
    const forbidden = await fetch(`${BASE}/api/design/stage/apply-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: otherSession },
      body: JSON.stringify({ taskId: TASK_ID, stageKey: "S1" }),
    });
    if (forbidden.status !== 403) throw new Error(`非演示账号守卫失效: ${forbidden.status}`);
    console.log("non-demo student guard ok (403)");

    // 4. 逐阶段应用演示答案并校验
    for (const stageKey of STAGES) {
      const res = await fetch(`${BASE}/api/design/stage/apply-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: session },
        body: JSON.stringify({ taskId: TASK_ID, stageKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(`apply ${stageKey} 失败: ${res.status} ${JSON.stringify(data)}`);

      const pr = await fetch(`${BASE}/api/design/progress?taskId=${TASK_ID}`, { headers: { cookie: session } });
      const pd = await pr.json();
      const run = pd.run;
      if (!run) throw new Error(`${stageKey}: progress 无 run`);
      const rec = run.stage_payloads?.[stageKey];
      if (!rec?.payload) throw new Error(`${stageKey}: stage_payloads 缺 payload`);
      if (run.stage_scores?.[stageKey] !== 100) throw new Error(`${stageKey}: 分数非 100 → ${run.stage_scores?.[stageKey]}`);
      const nxt = STAGES[STAGES.indexOf(stageKey) + 1];
      if (nxt && !run.unlocked_stages?.includes(nxt)) throw new Error(`${stageKey}: 未解锁 ${nxt}`);
      console.log(`apply ${stageKey} ok, score=100${nxt ? `, unlocked ${nxt}` : ""}`);
    }

    // 5. S6 后应收口
    const pr = await fetch(`${BASE}/api/design/progress?taskId=${TASK_ID}`, { headers: { cookie: session } });
    const run = (await pr.json()).run;
    if (run.status !== "completed" || run.total_score !== 100) {
      throw new Error(`S6 收口异常: status=${run.status} total=${run.total_score}`);
    }
    const s3zones = run.stage_payloads?.S3?.payload?.zones ?? [];
    const s5placements = (run.stage_payloads?.S5?.payload?.zones ?? []).reduce((s: number, z: any) => s + (z.placements?.length ?? 0), 0);
    console.log(`run completed, total_score=100, S3分区=${s3zones.length}, S5落位=${s5placements}`);
    console.log("ALL PASS");
    exitCode = 0;
  } finally {
    // 6. 清理：两个测试用户的 run 相关行 + auth 用户
    for (const uid of [userId, otherUserId]) {
      const { data: runs } = await admin.from("student_runs").select("id").eq("user_id", uid);
      for (const r of runs ?? []) {
        await admin.from("run_events").delete().eq("run_id", r.id);
        await admin.from("stage_records").delete().eq("run_id", r.id);
      }
      await admin.from("student_runs").delete().eq("user_id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
    console.log("cleanup done");
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
