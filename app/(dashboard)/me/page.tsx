import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate } from "@/lib/permissions";
import { ExecutorEstimateClient } from "@/app/(dashboard)/admin/executors/[id]/ExecutorEstimateClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!user.executorId) {
    redirect("/");
  }

  const allowed = await canViewExecutorEstimate(user, user.executorId);
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
        <p className="text-lg font-medium text-neutral-700">Доступ к смете отозван</p>
        <p className="text-sm text-neutral-500">Обратитесь к администратору.</p>
      </div>
    );
  }

  return (
    <ExecutorEstimateClient
      executorId={user.executorId}
      viewerRole={user.role}
      viewerExecutorId={user.executorId}
      viewerIsSuperAdmin={user.isSuperAdmin ?? false}
    />
  );
}
