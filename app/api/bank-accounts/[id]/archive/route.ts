import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { archiveBankAccount, unarchiveBankAccount } from "@/lib/services/bankAccounts";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const updated = await archiveBankAccount(id, me.id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const updated = await unarchiveBankAccount(id, me.id);
  return NextResponse.json(updated);
}
