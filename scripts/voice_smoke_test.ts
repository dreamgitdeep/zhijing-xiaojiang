import { getAdminClient } from '../src/lib/supabase-server';

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';
const STUDENT_NO = '4030501';
const PASSWORD = 'zjxj-voice-2026';
const EMAIL = 'voice-smoke@test.local';

async function main() {
  // 1. 注册测试学生
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student', name: '语音冒烟', studentNo: STUDENT_NO, email: EMAIL, password: PASSWORD }),
  });
  const regBody = await reg.json().catch(() => null);
  if (!reg.ok && !String(regBody?.error ?? '').includes('已存在')) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(regBody)}`);
  }
  console.log('register ok');

  // 2. 登录拿 session cookie
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: STUDENT_NO, password: PASSWORD }),
  });
  const loginBody = await login.json().catch(() => null);
  if (loginBody?.error) throw new Error(`login failed: ${loginBody.error}`);
  const setCookie = login.headers.get('set-cookie') ?? '';
  const session = setCookie.split(';')[0];
  if (!session.includes('zj_session=')) throw new Error('no session cookie');
  console.log('login ok');

  const authed = (path: string, payload: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session },
      body: JSON.stringify(payload),
    });

  // 3. 配额：连续 6 次申请，预期前 5 次 allowed、第 6 次拒绝
  const results: Array<{ allowed: boolean; used: number }> = [];
  for (let i = 0; i < 6; i += 1) {
    const r = await authed('/api/voice/session', {});
    const b = await r.json();
    if (!r.ok) throw new Error(`session failed at #${i + 1}: ${r.status} ${JSON.stringify(b)}`);
    results.push({ allowed: b.allowed, used: b.used });
  }
  const allowedCount = results.filter((r) => r.allowed).length;
  if (allowedCount !== 5 || results[5].allowed) {
    throw new Error(`quota unexpected: ${JSON.stringify(results)}`);
  }
  console.log('quota ok: 5 allowed then blocked ->', JSON.stringify(results[5]));

  // 4. TTS：返回音频字节
  const tts = await authed('/api/voice/tts', { text: '你好，我是场地顾问，语音链路冒烟测试。' });
  if (!tts.ok) throw new Error(`tts failed: ${tts.status} ${await tts.text()}`);
  const ct = tts.headers.get('content-type') ?? '';
  const mp3 = Buffer.from(await tts.arrayBuffer());
  if (!ct.startsWith('audio/') || mp3.length < 1000) {
    throw new Error(`tts bad response: ${ct} ${mp3.length} bytes`);
  }
  console.log(`tts ok: ${ct}, ${mp3.length} bytes`);

  // 5. ASR：把 TTS 音频（mp3）回传识别
  const asr = await authed('/api/voice/asr', { audio: mp3.toString('base64') });
  const asrBody = await asr.json().catch(() => null);
  if (!asr.ok || typeof asrBody?.text !== 'string' || !asrBody.text) {
    throw new Error(`asr failed: ${asr.status} ${JSON.stringify(asrBody)}`);
  }
  console.log(`asr ok: "${asrBody.text}"`);
  if (!asrBody.text.includes('场地顾问')) throw new Error('asr text mismatch');
  console.log('VOICE SMOKE PASS');
}

async function cleanup() {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const victim = data.users?.find((u) => u.email === `${STUDENT_NO}@stu.zhijing.edu.cn` || u.email === EMAIL);
  if (!victim) {
    console.log('cleanup: test user not found, skip');
    return;
  }
  await admin.from('voice_usage').delete().eq('user_id', victim.id);
  await admin.from('mastery').delete().eq('user_id', victim.id);
  await admin.from('quiz_attempts').delete().eq('user_id', victim.id);
  await admin.from('profiles').delete().eq('id', victim.id);
  await admin.auth.admin.deleteUser(victim.id);
  console.log('cleanup: test user removed', victim.id);
}

main()
  .then(() => cleanup())
  .catch(async (e) => {
    console.error('FAILED:', e.message);
    await cleanup().catch(() => {});
    process.exit(1);
  });
