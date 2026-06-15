import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canEditExecutorSettings, isProfileOwner } from "@/lib/permissions";
import { ExecutorEstimateClient } from "@/app/(dashboard)/admin/executors/[id]/ExecutorEstimateClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canEditExecutorSettings(user) && !isProfileOwner(user, id)) redirect("/");

  return (
    <ExecutorEstimateClient
      executorId={id}
      viewerRole={user.role}
      viewerExecutorId={user.executorId}
      backHref="/executor/executors"
      view="settings-only"
    />
  );
}
