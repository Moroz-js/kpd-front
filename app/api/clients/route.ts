import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createClient, listClients } from "@/lib/services/clients";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await listClients());
}

const createSchema = z.object({
  company: z.string().min(1, "Введите компанию"),
  department: z.string().min(1, "Введите департамент"),
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
    const created = await createClient(parsed.data, me.id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Клиент с такой парой департамент/компания уже существует" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
