import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listPayoutsPage } from "@/lib/views/payouts";
import { parsePayoutsListQuery } from "@/lib/views/payoutsQuery";

export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const query = parsePayoutsListQuery(req.nextUrl.searchParams);
  return NextResponse.json(await listPayoutsPage(query));
}
