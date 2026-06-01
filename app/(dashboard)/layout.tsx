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
    <div className="h-screen bg-neutral-50 overflow-hidden">
      <Sidebar role={role} fullName={fullName} hasProjects={hasProjects} />
      <main className="ml-60 h-screen overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
