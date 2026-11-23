import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getUserClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const LEGACY_ID = 'legacy';
const META_ROLE = 'conversation_meta';

type RenderEntry = { url?: string; plantId: string; at: string; status: 'ok' | 'failed' };
type Resources = {
  plantId: string;
  plantName: string;
  images: { url: string; alt: string }[];
  links: { title: string; url: string; snippet: string }[];
};

/**
 * 会话附件持久化：把推荐资源 / 生成效果图定点并入「该对话最近一条 assistant 消息」的 meta。
 * 读-改-写，仅更新 meta 字段，不整行覆盖；仅本人可写（RLS + user_id 过滤）。
 */
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!conversationId) return NextResponse.json({ error: 'conversationId 必填' }, { status: 400 });

  const resources: Resources | undefined =
    body?.resources && typeof body.resources === 'object' && Array.isArray(body.resources.images) ? body.resources : undefined;
  const render: RenderEntry | undefined =
    body?.render && typeof body.render === 'object' && typeof body.render.plantId === 'string' ? body.render : undefined;
  if (!resources && !render) return NextResponse.json({ error: 'resources 或 render 至少提供一个' }, { status: 400 });

  const client = getUserClient(auth.token);
  const base = client
    .from('chat_messages')
    .select('id, meta')
    .eq('user_id', auth.userId)
    .eq('role', 'assistant')
    .neq('role', META_ROLE)
    .order('id', { ascending: false })
    .limit(1);
  const { data, error } =
    conversationId === LEGACY_ID
      ? await base.is('conversation_id', null)
      : await base.eq('conversation_id', conversationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const row = data[0] as { id: number; meta: { resources?: Resources; renders?: RenderEntry[] } | null };
  const prev = row.meta ?? {};
  const next = { ...prev };
  if (resources) next.resources = resources;
  if (render) next.renders = [...(prev.renders ?? []), render];

  const { error: upErr } = await client.from('chat_messages').update({ meta: next }).eq('id', row.id).eq('user_id', auth.userId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
