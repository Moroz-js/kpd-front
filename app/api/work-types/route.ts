import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createWorkType, listWorkTypes } from "@/lib/services/workTypes";
import { WORK_TYPE_SEGMENTS } from "@/lib/statuses";

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  // Non-admin may only fetch active work types (for dropdowns)
  if (!isAdmin(me) && statusFilter !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listWorkTypes();
  if (statusFilter === "active") {
    return NextResponse.json(rows.filter((r) => r.status === "active").map((r) => ({ id: r.id, name: r.name, segment: r.segment })));
  }

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1),
  segment: z.enum(WORK_TYPE_SEGMENTS),
});

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const created = await createWorkType(parsed.data, me.id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Такой вид работ уже существует" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
