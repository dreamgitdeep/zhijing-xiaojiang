import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getUserClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface MasteryInput {
  plantId: string;
  bestScore: number;
  attempts: number;
  mastered: boolean;
  manual: boolean;
  updatedAt: string | null;
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const items: MasteryInput[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ merged: 0 });

  const client = getUserClient(auth.token);
  const { data: existingRows, error: fetchError } = await client
    .from('mastery')
    .select('plant_id, best_score, attempts, mastered, manual, updated_at')
    .eq('user_id', auth.userId);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const existing = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows ?? []) existing.set(row.plant_id, row);

  const upserts: Record<string, unknown>[] = [];
  for (const item of items) {
    if (typeof item.plantId !== 'string' || !item.plantId) continue;
    const prev = existing.get(item.plantId);
    const localBest = Number(item.bestScore) || 0;
    const localAttempts = Number(item.attempts) || 0;
    if (prev) {
      const merged = {
        user_id: auth.userId,
        plant_id: item.plantId,
        best_score: Math.max(prev.best_score, localBest),
        attempts: Math.max(prev.attempts, localAttempts),
        mastered: prev.mastered || item.mastered === true,
        manual: prev.manual || item.manual === true,
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
    } else if (localBest > 0 || localAttempts > 0 || item.mastered) {
      upserts.push({
        user_id: auth.userId,
        plant_id: item.plantId,
        best_score: localBest,
        attempts: localAttempts,
        mastered: item.mastered === true,
        manual: item.manual === true,
        updated_at: item.updatedAt ?? null,
      });
    }
  }

  for (let i = 0; i < upserts.length; i += 50) {
    const batch = upserts.slice(i, i + 50);
    const { error } = await client
      .from('mastery')
      .upsert(batch, { onConflict: 'user_id,plant_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merged: upserts.length });
}
