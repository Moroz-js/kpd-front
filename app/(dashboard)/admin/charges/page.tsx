import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ChargesClient } from "./ChargesClient";

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) redirect("/login");

  const [bankAccounts, orders] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { status: "active" },
      select: {
        id: true,
        orderNumber: true,
        description: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { orderNumber: "desc" },
    }),
  ]);

  return <ChargesClient bankAccounts={bankAccounts} orders={orders} />;
}
