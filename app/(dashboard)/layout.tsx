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
    <div className="h-screen overflow-hidden bg-neutral-50">
      <Sidebar role={role} fullName={fullName} hasProjects={hasProjects} />
      <main className="fixed top-0 left-60 right-0 bottom-0 overflow-y-auto bg-neutral-50" style={{ overflowX: "hidden" }}>
        <div className="p-6 w-full max-w-full min-w-0 box-border">{children}</div>
      </main>
    </div>
  );
}
