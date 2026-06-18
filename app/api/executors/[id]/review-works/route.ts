import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { listIssuedWorks } from "@/lib/views/issuedWorks";

type Ctx = { params: Promise<{ id: string }> };

// «Работы на проверку» — все работы, где исполнитель назначен «Ответственным»
// (responsibleExecutorId == executorId), по всем проектам (KPD-288).
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Доступ: admin или владелец личной сметы.
  if (!isAdmin(user) && user.executorId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listIssuedWorks({ responsibleExecutorId: [id] });
  return NextResponse.json(rows);
}
