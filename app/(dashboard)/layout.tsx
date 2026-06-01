import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as Record<string, unknown>;
  const role = user.role as string;
  const fullName = user.fullName as string;
  const userId = user.id as string;

  let hasProjects = true;
  if (role === "responsible") {
    const count = await prisma.project.count({ where: { responsibleUserId: userId } });
    hasProjects = count > 0;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar role={role} fullName={fullName} hasProjects={hasProjects} />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-neutral-50">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
