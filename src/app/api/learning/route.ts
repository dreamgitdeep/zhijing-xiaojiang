import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { emptyLearningDashboard, getLearningDashboard } from '@/lib/repo';
import { isCloudConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (user.role === 'teacher') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (!isCloudConfigured()) return NextResponse.json(emptyLearningDashboard());
  try {
    return NextResponse.json(await getLearningDashboard(user.id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
