import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { OtherExpensesClient } from "./OtherExpensesClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) redirect("/login");

  const [projects, executors, workTypes, responsibles, bankAccounts] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.executor.findMany({ where: { status: "active", OR: [{ userId: null }, { accessRevokedAt: { not: null } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workType.findMany({ where: { status: "active" }, select: { id: true, name: true, segment: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "responsible", isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.bankAccount.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <OtherExpensesClient
      isAdmin={true}
      userId={user.id}
      projects={projects}
      executors={executors}
      workTypes={workTypes as { id: string; name: string; segment: string }[]}
      responsibles={responsibles}
      bankAccounts={bankAccounts}
    />
  );
}
