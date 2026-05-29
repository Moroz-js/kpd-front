import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ActivityClient } from "./ActivityClient";

export default async function Page() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!isAdmin(me)) redirect("/me");

  return <ActivityClient />;
}
