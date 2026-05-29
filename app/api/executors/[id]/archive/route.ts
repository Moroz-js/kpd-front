import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  archiveExecutor,
  archiveExecutorPrecheck,
  unarchiveExecutor,
} from "@/lib/services/executors";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  return NextResponse.json(await archiveExecutorPrecheck(id));
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  return NextResponse.json(await archiveExecutor(id, me.id));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  return NextResponse.json(await unarchiveExecutor(id, me.id));
}
