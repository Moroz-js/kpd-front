import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const { role, fullName, id: userId, isSuperAdmin, executorId, executorType, isResponsible: isResponsibleFlag, responsibleActive } = sessionUser;

  const isPm =
    role === "responsible" ||
    (role === "executor" && isResponsibleFlag && responsibleActive);
  const isPermanentExecutor = role === "executor" && executorType === "permanent";
  const hasProfile = !!executorId;

  let hasProjects = true;
  if (isPm) {
    const count = await prisma.project.count({ where: { responsibleUserId: userId } });
    hasProjects = count > 0;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        role={role}
        fullName={fullName}
        userId={userId}
        isSuperAdmin={isSuperAdmin ?? false}
        hasProjects={hasProjects}
        isPm={isPm}
        isPermanentExecutor={isPermanentExecutor}
        hasProfile={hasProfile}
      />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-neutral-50">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
