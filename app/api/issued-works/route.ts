import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listIssuedWorks } from "@/lib/views/issuedWorks";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await listIssuedWorks());
}
