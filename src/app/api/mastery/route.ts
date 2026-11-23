import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getUserClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface MasteryRow {
  plant_id: string;
  best_score: number;
  attempts: number;
  mastered: boolean;
  manual: boolean;
  updated_at: string | null;
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const client = getUserClient(auth.token);
  const { data, error } = await client
    .from('mastery')
    .select('plant_id, best_score, attempts, mastered, manual, updated_at')
    .eq('user_id', auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data as MasteryRow[] });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plantId = body?.plantId;
  const mastered = body?.mastered === true;
  if (typeof plantId !== 'string' || !plantId) {
    return NextResponse.json({ error: 'plantId 必填' }, { status: 400 });
  }

  const client = getUserClient(auth.token);
  const { data: existing } = await client
    .from('mastery')
    .select('plant_id, best_score, attempts, mastered, manual, updated_at')
    .eq('user_id', auth.userId)
    .eq('plant_id', plantId)
    .maybeSingle();

  const row = {
    user_id: auth.userId,
    plant_id: plantId,
    best_score: existing?.best_score ?? 0,
    attempts: existing?.attempts ?? 0,
    mastered,
    manual: true,
    updated_at: existing?.updated_at ?? null,
  };

  const { error } = await client
    .from('mastery')
    .upsert(row, { onConflict: 'user_id,plant_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
