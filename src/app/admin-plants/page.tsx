import type { Metadata } from "next";
import { requireTeacher } from "@/lib/auth";
import { listPlants } from "@/lib/repo";
import { loadDataset } from "@/lib/data";
import { ensureQuizQids } from "@/lib/mastery-engine";
import { getMasteryPassRatio } from "@/lib/settings";
import type { Plant } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_COPY } from "@/config/pages";
import { formatTemplate } from "@/config/site";
import PlantsAdminClient, { type PlantRow } from "@/components/PlantsAdminClient";

export const metadata: Metadata = { title: "植物数据管理 · 植景小匠" };

const FALLBACK_QUIZ_DIMENSIONS = ["光照习性", "水分习性", "土壤要求", "观赏与季相", "配置方式", "安全应用"];

export default async function AdminPlantsPage() {
  const teacher = await requireTeacher();
  if (!teacher) return null;

  const [dataset, plants, passRatio] = await Promise.all([loadDataset(), listPlants(), getMasteryPassRatio()]);
  const rows: PlantRow[] = plants.map((row) => {
    const p = ensureQuizQids(row.data as unknown as Plant);
    return {
      id: row.id,
      name: row.name,
      latin: p.latin ?? "",
      category: row.category,
      layer: row.layer,
      isWarning: Boolean(p.isWarning),
      restriction: row.warning,
      quizCount: Array.isArray(p.quiz) ? p.quiz.length : 0,
      updatedAt: (row.updated_at ?? "").slice(0, 10),
      thumbUrl: p.images?.thumb || p.images?.full || "",
      data: p,
    };
  });

  const quizDimensions = dataset.quizDimensions?.length ? dataset.quizDimensions : FALLBACK_QUIZ_DIMENSIONS;

  return (
    <AppShell user={teacher} floral>
      <div className="w-full py-8">
        <PageHeader
          title={PAGE_COPY.adminPlants.title}
          description={formatTemplate(PAGE_COPY.adminPlants.descriptionTemplate, { count: rows.length })}
          className="mb-5"
        />
        <PlantsAdminClient
          rows={rows}
          categories={dataset.filters.categories}
          quizDimensions={quizDimensions}
          passRatio={passRatio}
        />
      </div>
    </AppShell>
  );
}
