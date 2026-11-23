import { getSupabaseClient } from "../src/storage/database/supabase-client";

const BASE = "http://localhost:5000";
const TEACHER_EMAIL = "t-remind@stu.zhijing.edu.cn";
const STUDENT_EMAIL = "s-remind-01@stu.zhijing.edu.cn";
const PASSWORD = "zjxj-remind-2026";

async function login(identifier: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`登录 ${identifier} 失败: ${body.error ?? res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/zj_session=[^;]+/);
  if (!m) throw new Error(`登录 ${identifier} 未返回 session cookie`);
  return m[0];
}

async function main() {
  const admin = getSupabaseClient();

  // 1. 临时教师 + 临时学生（独立班级码 test-remind，避免波及真实学生）
  const t = await admin.auth.admin.createUser({
    email: TEACHER_EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { name: "提醒冒烟教师", role: "teacher", account: "t-remind" },
  });
  if (t.error) throw new Error(`建教师失败: ${t.error.message}`);
  const s = await admin.auth.admin.createUser({
    email: STUDENT_EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { name: "提醒冒烟学生", role: "student", student_no: "s-remind-01", class_name: "提醒测试班", class_code: "test-remind" },
  });
  if (s.error) throw new Error(`建学生失败: ${s.error.message}`);
  const teacherId = t.data.user!.id;
  const studentId = s.data.user!.id;
  console.log("users ok:", teacherId, studentId);

  // 2. 临时已发布任务（仅发布到 test-remind 班；design_tasks.id 为 text，刻意用非 uuid id 回归类型问题）
  const taskId = `remind-smoke-${Date.now()}`;
  const { error: taskErr } = await admin.from("design_tasks").insert({
    id: taskId, case_id: "chuangzhi", title: "提醒冒烟任务", status: "published",
    published_classes: ["test-remind"], task_def: { id: taskId, name: "提醒冒烟任务", stages: [] }, nongyuan: {},
  });
  if (taskErr) throw new Error(`建任务失败: ${taskErr.message}`);
  console.log("task ok:", taskId);

  // 3. 教师端：未完成名单 + 发送提醒
  const teacherCookie = await login("t-remind");
  const g = await fetch(`${BASE}/api/admin/design-tasks/${taskId}/remind`, { headers: { cookie: teacherCookie } });
  const gd = await g.json();
  if (!g.ok) throw new Error(`GET remind 失败: ${gd.error}`);
  if (gd.pending.length !== 1 || gd.pending[0].userId !== studentId)
    throw new Error(`pending 名单异常: ${JSON.stringify(gd.pending)}`);
  console.log("GET remind ok: pending=1, hasRun=", gd.pending[0].hasRun);

  const p1 = await fetch(`${BASE}/api/admin/design-tasks/${taskId}/remind`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: teacherCookie },
    body: JSON.stringify({ message: "冒烟测试留言" }),
  });
  const p1d = await p1.json();
  if (!p1.ok || p1d.reminded !== 1) throw new Error(`首次提醒异常: ${JSON.stringify(p1d)}`);
  console.log("POST remind ok: reminded=1");

  const p2 = await fetch(`${BASE}/api/admin/design-tasks/${taskId}/remind`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: teacherCookie },
    body: JSON.stringify({}),
  });
  const p2d = await p2.json();
  if (!p2.ok || p2d.reminded !== 0 || p2d.skipped !== 1) throw new Error(`重复提醒去重异常: ${JSON.stringify(p2d)}`);
  console.log("POST remind dedupe ok: reminded=0 skipped=1");

  // 4. 学生端：通知列表 / 未读数 / 全部已读
  const studentCookie = await login("s-remind-01");
  const n = await fetch(`${BASE}/api/notifications`, { headers: { cookie: studentCookie } });
  const nd = await n.json();
  if (!n.ok || nd.items.length !== 1 || nd.unread !== 1) throw new Error(`通知列表异常: ${JSON.stringify(nd)}`);
  const item = nd.items[0];
  if (item.link !== `/design/${taskId}` || !item.content.includes("冒烟测试留言"))
    throw new Error(`通知内容异常: ${JSON.stringify(item)}`);
  console.log("student list ok: unread=1, link=", item.link);

  const u1 = await fetch(`${BASE}/api/notifications/unread`, { headers: { cookie: studentCookie } });
  if ((await u1.json()).unread !== 1) throw new Error("未读数应为 1");

  const r = await fetch(`${BASE}/api/notifications/read`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: studentCookie },
    body: JSON.stringify({ all: true }),
  });
  if (!r.ok) throw new Error("标记已读失败");
  const u2 = await fetch(`${BASE}/api/notifications/unread`, { headers: { cookie: studentCookie } });
  if ((await u2.json()).unread !== 0) throw new Error("标记已读后未读数应为 0");
  console.log("student read ok: unread 1 -> 0");

  console.log("SMOKE PASS");
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(async () => {
    const admin = getSupabaseClient();
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const ids = (users?.users ?? []).filter((u) => [TEACHER_EMAIL, STUDENT_EMAIL].includes(u.email ?? "")).map((u) => u.id);
    if (ids.length) {
      await admin.from("notifications").delete().in("user_id", ids);
      await admin.from("design_tasks").delete().eq("title", "提醒冒烟任务");
      for (const id of ids) await admin.auth.admin.deleteUser(id);
      await admin.from("profiles").delete().in("id", ids);
      console.log("cleanup done, removed users:", ids.length);
    }
  });
