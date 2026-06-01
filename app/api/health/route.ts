import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "connected" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[health] database error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
