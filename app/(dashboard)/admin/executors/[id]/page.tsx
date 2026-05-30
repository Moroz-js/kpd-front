import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorEstimate } from "@/lib/permissions";
import { ExecutorEstimateClient } from "./ExecutorEstimateClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = await canViewExecutorEstimate(user, id);
  if (!allowed) redirect("/");

  return (
    <ExecutorEstimateClient
      executorId={id}
      viewerRole={user.role}
      viewerExecutorId={user.executorId}
      backHref="/admin/executors"
      initialTab={tab}
    />
  );
}
