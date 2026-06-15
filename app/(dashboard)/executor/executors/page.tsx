import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canViewExecutorsList, canManageExecutors } from "@/lib/permissions";
import { ExecutorsClient } from "@/app/(dashboard)/admin/executors/ExecutorsClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !canViewExecutorsList(user)) redirect("/login");

  return <ExecutorsClient mode="manage" canAdd={canManageExecutors(user)} />;
}
