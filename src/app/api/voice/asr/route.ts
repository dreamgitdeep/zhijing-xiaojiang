import { NextRequest, NextResponse } from "next/server";
import { ASRClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BASE64 = 8_000_000;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const audio = typeof body?.audio === "string" ? body.audio : "";
  if (!audio || audio.length > MAX_BASE64) {
    return NextResponse.json({ error: "invalid audio payload" }, { status: 400 });
  }
  try {
    const forward = HeaderUtils.extractForwardHeaders(
      Object.fromEntries(req.headers.entries())
    );
    const client = new ASRClient(new Config(), forward);
    const result = await client.recognize({ uid: user.id, base64Data: audio });
    return NextResponse.json({ text: (result.text ?? "").trim() });
  } catch {
    return NextResponse.json({ error: "ASR_FAILED" }, { status: 502 });
  }
}
