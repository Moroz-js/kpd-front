import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createExecutor, listExecutors } from "@/lib/services/executors";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await listExecutors());
}

const personSchema = z.object({
  type: z.enum(["permanent", "external-person"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email("Некорректный email"),
  password: z.string().optional(),
  companyStatus: z.string().nullable().optional(),
  responsibleUserId: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  defaultBankAccountId: z.string().nullable().optional(),
  recipientType: z.string().nullable().optional(),
});

const legalSchema = z.object({
  type: z.literal("external-legal"),
  legalName: z.string().min(1),
  legalForm: z.string().min(1),
  responsibleUserId: z.string().nullable().optional(),
  recipientType: z.string().nullable().optional(),
  defaultBankAccountId: z.string().nullable().optional(),
});

const serviceSchema = z.object({
  type: z.literal("service"),
  legalName: z.string().min(1),
  responsibleUserId: z.string().nullable().optional(),
  recipientType: z.string().nullable().optional(),
  defaultBankAccountId: z.string().nullable().optional(),
});

const createSchema = z.union([personSchema, legalSchema, serviceSchema]);

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
    const created = await createExecutor(parsed.data, me.id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Email уже занят" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
