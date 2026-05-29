import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { updateIssuedWork } from "@/lib/services/issuedWorks";

function parseId(id: string): { sourceType: "personal" | "other-expense"; sourceId: string } | null {
  const idx = id.indexOf(":");
  if (idx < 0) return null;
  const sourceType = id.slice(0, idx);
  const sourceId = id.slice(idx + 1);
  if (sourceType !== "personal" && sourceType !== "other-expense") return null;
  return { sourceType, sourceId };
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const parsedId = parseId(id);
  if (!parsedId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  try {
    const updated = await updateIssuedWork(
      parsedId.sourceType,
      parsedId.sourceId,
      { workStatus: "checked" },
      me.id
    );
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
