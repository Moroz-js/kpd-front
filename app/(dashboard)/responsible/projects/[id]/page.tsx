import { getSessionUser } from "@/lib/auth";
import { isAdmin, isResponsible } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectDashboardClient } from "@/app/(dashboard)/admin/projects/[id]/ProjectDashboardClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!isAdmin(me) && !isResponsible(me)) redirect("/me");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  if (!isAdmin(me) && project.responsibleUserId !== me.id) {
    redirect("/responsible/projects");
  }

  return <ProjectDashboardClient projectId={id} isAdmin={isAdmin(me)} canManagePlan={true} />;
}
