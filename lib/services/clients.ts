/**
 * ClientService (TDNB-21).
 *
 * Computed:
 *   A (name)         = `${department} – ${company}`
 *   D (projectNames) = список Project.name по этому клиенту
 *   E (projectStatus) = "active" | "all-archived" | "none"
 *   F (revenue)      = SUM(Charge.amount WHERE status=paid) через цепочку client → projects → orders → charges
 */

import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";

export type ClientListRow = {
  id: string;
  name: string;
  company: string;
  department: string;
  status: string;
  projects: { id: string; name: string }[];
  projectNames: string[];
  projectsStatus: "has_active" | "all_archived" | "none";
  revenue: number;
  createdAt: Date;
};

export type ClientProjectsStatus = ClientListRow["projectsStatus"];

export function clientName(department: string, company: string): string {
  return `${department.trim()} – ${company.trim()}`;
}

export async function listClients(): Promise<ClientListRow[]> {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          orders: {
            select: {
              charges: { select: { amount: true, status: true } },
            },
          },
        },
      },
    },
  });

  return clients.map((c) => {
    const sortedProjects = [...c.projects].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const hasActive = c.projects.some((p) => p.status === "active");
    const hasArchived = c.projects.some((p) => p.status === "archived");
    const projectsStatus: ClientProjectsStatus =
      hasActive ? "has_active" : hasArchived ? "all_archived" : "none";

    let revenue = 0;
    for (const p of c.projects) {
      for (const o of p.orders) {
        for (const ch of o.charges) {
          if (ch.status === "paid") revenue += ch.amount;
        }
      }
    }

    return {
      id: c.id,
      name: c.name,
      company: c.company,
      department: c.department,
      status: c.status,
      projectNames: sortedProjects.map((p) => p.name),
      projects: sortedProjects.map((p) => ({ id: p.id, name: p.name })),
      projectsStatus,
      revenue,
      createdAt: c.createdAt,
    };
  });
}

export type CreateClientInput = {
  company: string;
  department: string;
};

export async function createClient(input: CreateClientInput, userId: string) {
  const name = clientName(input.department, input.company);
  const created = await prisma.client.create({
    data: {
      company: input.company.trim(),
      department: input.department.trim(),
      name,
      status: "active",
    },
  });
  await logActivity({
    userId,
    action: "create",
    entityType: "Client",
    entityId: created.id,
    entityLabel: created.name,
  });
  return created;
}

export type UpdateClientInput = {
  company?: string;
  department?: string;
};

export async function updateClient(id: string, patch: UpdateClientInput, userId: string) {
  const before = await prisma.client.findUnique({ where: { id } });
  if (!before) throw new Error("Client not found");

  const department = patch.department?.trim() ?? before.department;
  const company = patch.company?.trim() ?? before.company;
  const name = clientName(department, company);

  const updated = await prisma.client.update({
    where: { id },
    data: { company, department, name },
  });

  const changes = diff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "Client",
      entityId: id,
      entityLabel: updated.name,
      changes,
    });
  }

  return updated;
}

export async function archiveClient(id: string, userId: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Client not found");
  const updated = await prisma.client.update({ where: { id }, data: { status: "archived" } });
  await logActivity({
    userId,
    action: "archive",
    entityType: "Client",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}

export async function unarchiveClient(id: string, userId: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Client not found");
  const updated = await prisma.client.update({ where: { id }, data: { status: "active" } });
  await logActivity({
    userId,
    action: "unarchive",
    entityType: "Client",
    entityId: id,
    entityLabel: updated.name,
  });
  return updated;
}
