import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { executorWhereForOtherExpense } from "@/lib/executor-personal-estimate";
import { listActiveResponsibleUsers } from "@/lib/services/responsibles";
import { OtherExpensesClient } from "./OtherExpensesClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) redirect("/login");

  const [projects, executors, workTypes, responsibles, bankAccounts] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.executor.findMany({ where: executorWhereForOtherExpense, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workType.findMany({ where: { status: "active" }, select: { id: true, name: true, segment: true }, orderBy: { name: "asc" } }),
    listActiveResponsibleUsers(),
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
