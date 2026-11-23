import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import QuizClient from '@/components/QuizClient';
import { getSessionUser } from '@/lib/auth';
import { loadPlantsForServer } from '@/lib/data';
import { questionIds } from '@/lib/mastery-engine';
import { getMastery } from '@/lib/repo';
import { getMasteryPassRatio } from '@/lib/settings';
import { isCloudConfigured } from '@/lib/supabase-server';
import { layerLabel } from '@/lib/types';

interface PlantQuizPageProps {
  searchParams: Promise<{ plantId?: string }>;
}

export default async function PlantQuizPage({ searchParams }: PlantQuizPageProps) {
  const params = await searchParams;
  const dataset = await loadPlantsForServer();
  const user = await getSessionUser();
  const plant = dataset.plants.find((item) => item.id === params.plantId) ?? dataset.plants[0];

  if (!plant) {
    return (
      <AppShell user={user}>
        <div className="student-vivid w-full pb-16 pt-10">
          <p className="text-fs-sub text-on-surface-variant">未找到该植物。</p>
        </div>
      </AppShell>
    );
  }

  const cloud = isCloudConfigured();
  const mastery = user ? await getMastery() : null;
  const info = mastery?.items.get(plant.id);
  const passRatio = cloud ? await getMasteryPassRatio() : 1;

  return (
    <AppShell user={user}>
      <div className="student-vivid w-full pb-16 pt-10">
        <Link href="/catalog" className="text-fs-label text-foreground hover:underline">
          ← 返回植物图鉴
        </Link>
        <h1 className="mt-4 text-fs-title font-medium text-on-surface">{plant.name} · 知识练习</h1>
        <p className="mt-2 text-fs-sub text-on-surface-variant">
          {plant.latin} · {plant.category} · {layerLabel(plant.layer)} · 共 {plant.quiz.length} 道题
        </p>
        <QuizClient
          plant={plant}
          isCloud={cloud}
          bestScore={info?.bestScore ?? null}
          mastered={info?.mastered ?? false}
          pendingIds={info?.pendingQuestionIds ?? questionIds(plant.quiz)}
          passRatio={passRatio}
          correctedCount={info?.correctedCount ?? 0}
          totalCount={info?.totalCount ?? plant.quiz.length}
        />
      </div>
    </AppShell>
  );
}
