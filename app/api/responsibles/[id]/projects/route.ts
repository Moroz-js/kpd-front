import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { assignResponsibleProjects } from "@/lib/services/responsibles";

const schema = z.object({
  projectIds: z.array(z.string()),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation" }, { status: 400 });
  }
  await assignResponsibleProjects(id, parsed.data.projectIds, me.id);
  return NextResponse.json({ ok: true });
}
