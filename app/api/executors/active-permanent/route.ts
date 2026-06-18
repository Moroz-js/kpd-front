import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listActivePermanentExecutors } from "@/lib/services/executors";

// Список активных постоянных исполнителей для dropdown «Ответственный» (KPD-284/285).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listActivePermanentExecutors();
  return NextResponse.json(rows);
}
