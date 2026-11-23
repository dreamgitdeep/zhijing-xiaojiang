import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadPlantsForServer } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const dataset = await loadPlantsForServer();
  const plant = dataset.plants.find((p) => p.id === id);
  if (!plant) {
    return NextResponse.json({ error: "PLANT_NOT_FOUND" }, { status: 404 });
  }
  const { quiz: _quiz, ...detail } = plant;
  return NextResponse.json(detail);
}
