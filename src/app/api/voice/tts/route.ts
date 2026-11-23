import { NextRequest, NextResponse } from "next/server";
import { TTSClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SPEAKER = "zh_female_vv_uranus_bigtts";
const MAX_TEXT = 500;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: "text too long" }, { status: 400 });
  }
  try {
    const forward = HeaderUtils.extractForwardHeaders(
      Object.fromEntries(req.headers.entries())
    );
    const client = new TTSClient(new Config(), forward);
    const res = await client.synthesize({
      uid: user.id,
      text,
      speaker: SPEAKER,
      audioFormat: "mp3",
    });
    const audio = await fetch(res.audioUri);
    if (!audio.ok) throw new Error(`audio fetch failed: ${audio.status}`);
    const buf = await audio.arrayBuffer();
    return new NextResponse(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "TTS_FAILED" }, { status: 502 });
  }
}
