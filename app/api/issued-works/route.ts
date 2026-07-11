import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listIssuedWorksPage } from "@/lib/views/issuedWorks";
import { parseIssuedWorksListQuery } from "@/lib/views/issuedWorksQuery";

export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const query = parseIssuedWorksListQuery(req.nextUrl.searchParams);
  const result = await listIssuedWorksPage(query);
  return NextResponse.json(result);
}
