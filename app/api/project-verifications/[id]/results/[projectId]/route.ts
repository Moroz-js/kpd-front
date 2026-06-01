import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const schema = z.object({
  checked: z.boolean().optional(),
  comment: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: verificationId, projectId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 422 });

  const data: { checked?: boolean; comment?: string | null } = {};
  if (parsed.data.checked !== undefined) data.checked = parsed.data.checked;
  if (parsed.data.comment !== undefined) data.comment = parsed.data.comment;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 422 });
  }

  const result = await prisma.projectVerificationResult.updateMany({
    where: { verificationId, projectId },
    data,
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
