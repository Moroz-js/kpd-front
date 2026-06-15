import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessOtherExpenses } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { executorWhereForOtherExpense } from "@/lib/executor-personal-estimate";
import { listActiveResponsibleUsers } from "@/lib/services/responsibles";
import { OtherExpensesClient } from "@/app/(dashboard)/admin/other-expenses/OtherExpensesClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !canAccessOtherExpenses(user)) redirect("/login");

  const [projects, executors, workTypes, responsibles, bankAccounts] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.executor.findMany({ where: executorWhereForOtherExpense, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workType.findMany({ where: { status: "active" }, select: { id: true, name: true, segment: true }, orderBy: { name: "asc" } }),
    listActiveResponsibleUsers(),
    prisma.bankAccount.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Прочие траты</h1>
      <OtherExpensesClient
        isAdmin={false}
        userId={user.id}
        projects={projects}
        executors={executors}
        workTypes={workTypes as { id: string; name: string; segment: string }[]}
        responsibles={responsibles}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
