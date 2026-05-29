import { getSessionUser } from "@/lib/auth";
import { isAdmin, isResponsible } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CashflowClient } from "@/app/(dashboard)/admin/cashflow/CashflowClient";

export default async function Page() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!isAdmin(me) && !isResponsible(me)) redirect("/me");

  return <CashflowClient />;
}
