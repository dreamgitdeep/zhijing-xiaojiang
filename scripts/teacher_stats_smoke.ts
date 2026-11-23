import "dotenv/config";
import { getAdminClient } from "../src/lib/supabase-server";
import {
  getTeacherStats,
  getStudentRows,
  getClassComparison,
  getHardPlants,
  getStudentDetail,
} from "../src/lib/repo";

async function main() {
  const admin = getAdminClient();
  const stamp = Date.now();
  const email = `smoke_${stamp}@test.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "Smoke123456",
    email_confirm: true,
    user_metadata: { role: "student", name: "冒烟学生", student_no: `S${stamp}`, class_name: "景观2301" },
  });
  if (error || !created.user) throw new Error("createUser failed: " + error?.message);
  const uid = created.user.id;

  const ins = await admin.from("quiz_attempts").insert({
    user_id: uid,
    plant_id: "p001",
    score: 6,
    total: 6,
  });
  if (ins.error) throw new Error("insert attempt: " + ins.error.message);

  const mast = await admin.from("mastery").upsert({
    user_id: uid,
    plant_id: "p001",
    mastered: true,
    manual: false,
    best_score: 6,
    attempts: 1,
  });
  if (mast.error) throw new Error("upsert mastery: " + mast.error.message);

  const chk = await admin.from("mastery").select("user_id, mastered").eq("user_id", uid);
  console.log("mastery readback:", JSON.stringify(chk.data), chk.error?.message ?? "");

  const stats = await getTeacherStats();
  const rows = await getStudentRows();
  const classes = await getClassComparison();
  const hard = await getHardPlants();
  const detail = await getStudentDetail(uid);

  const me = rows.find((r) => r.userId === uid);
  console.log("studentCount:", stats.studentTotal, "| active:", stats.activeRecent, "| attempts:", stats.attemptTotal);
  console.log("row:", me && { name: me.name, mastered: me.mastered, attempts: me.attempts, avg: me.avgScore });
  console.log("classes:", JSON.stringify(classes));
  console.log("hard:", hard.length, "p001 in hard:", hard.some((h) => h.plantId === "p001"));
  console.log("detail:", detail.plantGrid.length, "grid,", detail.recentAttempts.length, "attempts");

  const ok =
    me && me.mastered === 1 && me.attempts === 1 && me.avgScore === 100 &&
    stats.studentTotal >= 1 && stats.activeRecent >= 1 && stats.attemptTotal >= 1 &&
    detail.plantGrid.length === 1 && detail.recentAttempts.length === 1 &&
    classes.some((c) => c.className === "景观2301");

  await admin.auth.admin.deleteUser(uid);
  console.log(ok ? "TEACHER STATS SMOKE: PASS" : "TEACHER STATS SMOKE: FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("SMOKE ERROR:", e);
  process.exit(1);
});
