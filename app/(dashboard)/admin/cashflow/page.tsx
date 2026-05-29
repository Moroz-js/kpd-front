import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CashflowClient } from "./CashflowClient";

export default async function Page() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!isAdmin(me)) redirect("/me");

  return <CashflowClient />;
}
