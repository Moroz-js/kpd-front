import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, canViewExecutorsList } from "@/lib/permissions";
import { createBankAccount, listBankAccounts } from "@/lib/services/bankAccounts";

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status"); // active | archived | all

  // Non-admin may request active bank accounts (for dropdowns).
  // PM/постоянный исполнитель управляют исполнителями — им нужен полный список счетов.
  if (!isAdmin(me) && statusFilter !== "active" && !canViewExecutorsList(me)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listBankAccounts();

  if (statusFilter === "active") {
    const active = rows
      .filter((r) => r.status === "active")
      .map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }));
    return NextResponse.json(active);
  }

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1, "Введите название счёта"),
  details: z.string().optional(),
  isDefault: z.boolean().optional(),
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
    const created = await createBankAccount(parsed.data, me.id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Счёт с таким названием уже существует" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
