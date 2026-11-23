import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getUserClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const LEGACY_ID = 'legacy';
const META_ROLE = 'conversation_meta';
const TITLE_MAX = 40;

type Row = {
  id: number;
  conversation_id: string | null;
  role: string;
  content: string;
  created_at: string;
  source: string | null;
};

function convKeyOf(row: { conversation_id: string | null }) {
  return row.conversation_id ?? LEGACY_ID;
}

// GET：不带参数返回对话列表；带 conversationId 返回该对话消息（按需加载）
export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const client = getUserClient(auth.token);
  const conversationId = new URL(req.url).searchParams.get('conversationId');

  if (conversationId) {
    const q = client
      .from('chat_messages')
      .select('role, content, meta')
      .eq('user_id', auth.userId)
      .neq('role', META_ROLE)
      .order('created_at', { ascending: true })
      .limit(300);
    const { data, error } =
      conversationId === LEGACY_ID
        ? await q.is('conversation_id', null)
        : await q.eq('conversation_id', conversationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // 本人名下查无该会话（或会话不存在）一律 404，不泄露他人会话是否存在
    if (!data || data.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({
      messages: (data ?? []).map((m: { role: string; content: string; meta: unknown }) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        meta: m.meta ?? null,
      })),
    });
  }

  const { data, error } = await client
    .from('chat_messages')
    .select('id, conversation_id, role, content, created_at, source')
    .eq('user_id', auth.userId)
    .order('id', { ascending: true })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const convs = new Map<string, { title: string | null; firstUser: string | null; lastAt: string; count: number; source: string }>();
  for (const row of (data ?? []) as Row[]) {
    const key = convKeyOf(row);
    let c = convs.get(key);
    if (!c) {
      c = { title: null, firstUser: null, lastAt: row.created_at, count: 0, source: row.source ?? 'chat' };
      convs.set(key, c);
    }
    if (row.created_at > c.lastAt) c.lastAt = row.created_at;
    if (row.role === META_ROLE) {
      c.title = row.content;
    } else {
      c.count += 1;
      if (row.role === 'user' && c.firstUser === null) c.firstUser = row.content;
    }
  }

  const conversations = [...convs.entries()]
    .filter(([, c]) => c.count > 0)
    .map(([id, c]) => ({
      id,
      legacy: id === LEGACY_ID,
      title:
        id === LEGACY_ID
          ? (c.title ?? '').trim().slice(0, TITLE_MAX) || '历史记录'
          : (c.title ?? c.firstUser ?? '').trim().slice(0, TITLE_MAX) || '新对话',
      lastAt: c.lastAt,
      source: c.source === 'catalog' ? 'catalog' : 'chat',
    }))
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  return NextResponse.json({ conversations });
}

// PATCH：重命名对话（标题存为 conversation_meta 行）
export async function PATCH(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, TITLE_MAX) : '';
  if (!conversationId || !title) return NextResponse.json({ error: 'conversationId 与标题必填' }, { status: 400 });

  const client = getUserClient(auth.token);
  const del = client.from('chat_messages').delete().eq('user_id', auth.userId).eq('role', META_ROLE);
  const { error: delErr } =
    conversationId === LEGACY_ID
      ? await del.is('conversation_id', null)
      : await del.eq('conversation_id', conversationId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { error } = await client.from('chat_messages').insert({
    user_id: auth.userId,
    conversation_id: conversationId === LEGACY_ID ? null : conversationId,
    role: META_ROLE,
    content: title,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE：删除整个对话（含兜底的「历史记录」）
export async function DELETE(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const conversationId = new URL(req.url).searchParams.get('conversationId')?.trim();
  if (!conversationId) return NextResponse.json({ error: 'conversationId 必填' }, { status: 400 });

  const client = getUserClient(auth.token);
  const q = client.from('chat_messages').delete().eq('user_id', auth.userId);
  const { error } =
    conversationId === LEGACY_ID
      ? await q.is('conversation_id', null)
      : await q.eq('conversation_id', conversationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
