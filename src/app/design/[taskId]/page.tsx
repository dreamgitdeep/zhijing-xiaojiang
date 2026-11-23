import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRun, getTaskFull } from "@/lib/design";
import { loadPlantsForServer } from "@/lib/data";
import { toPlantPick } from "@/lib/plant-compliance";
import { DesignCase } from "@/components/design/DesignCase";

export const metadata: Metadata = { title: "设计案例 · 植景小匠" };
export const dynamic = "force-dynamic";

export default async function DesignTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const [user, full, dataset] = await Promise.all([
    getSessionUser(),
    getTaskFull(taskId).catch(() => null),
    loadPlantsForServer().catch(() => null),
  ]);
  if (!full) notFound();

  const run = user ? await getRun(taskId, user.id).catch(() => null) : null;
  // S4 植物选择器用：只投影选择/合规所需字段（不含 quiz/笔记等），失败时给空列表不阻断
  const plants = (dataset?.plants ?? []).map(toPlantPick);

  // referenceSolution 仅供服务端评阅链路使用，不得进入客户端 payload
  const { referenceSolution: _omitted, ...safeTask } = full.task;
  // case.designTaskNote 为内部备注（含评分锚点词），不下发学生端
  const { designTaskNote: _note, ...safeCase } = (safeTask.case ?? {}) as Record<string, any>;

  // nongyuan 含问询答案、分区答案、原则正误等评分密钥，下发学生端前脱敏
  const n = full.nongyuan as Record<string, any>;
  const safeNongyuan = {
    ...n,
    site: undefined,
    positioningRule: undefined,
    inquiry: {
      ...n.inquiry,
      entries: (n.inquiry?.entries ?? []).map((e: any) => ({ id: e.id, topic: e.topic, importance: e.importance })),
    },
    diagnosisForm: (n.diagnosisForm ?? []).map((f: any) => ({ key: f.key, label: f.label, hint: f.hint })),
    principleOptions: (n.principleOptions ?? []).map(({ correct, ...rest }: any) => rest),
    // S3 画布：只下发空白底图与坐标系，绝不给 site.zones/constraints/答案图
    canvas: { asset: "/images/tasks/chuangzhi/site-plan-blank.webp", viewBox: [0, 0, 1024, 2048] },
  };

  return <DesignCase user={user} task={{ ...safeTask, case: safeCase }} nongyuan={safeNongyuan} run={run} plants={plants} />;
}
