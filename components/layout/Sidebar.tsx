"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(dashboard)/actions";
import {
  FolderOpen,
  Users,
  Briefcase,
  CreditCard,
  TrendingUp,
  LogOut,
  UserCheck,
  Receipt,
  FileText,
  Building2,
  Wallet,
  Wrench,
  ShoppingCart,
  History,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

/**
 * Состав sidebar по ролям (см. TZ Приложение B / TDNB-31).
 * Часть пунктов на Phase 0 ведёт на заглушки — заполнятся реальными в Phase 1+.
 */
const NAV_CONFIG: Record<string, NavGroup[]> = {
  admin: [
    {
      items: [
        { label: "Проекты", href: "/admin/projects", icon: FolderOpen },
        { label: "Ответственные", href: "/admin/responsibles", icon: UserCheck },
        { label: "Исполнители", href: "/admin/executors", icon: Users },
        { label: "Выставленные работы", href: "/admin/issued-works", icon: Briefcase },
        { label: "Выплаты", href: "/admin/payouts", icon: CreditCard },
        { label: "Прочие траты", href: "/admin/other-expenses", icon: Receipt },
        { label: "Кэшфлоу", href: "/admin/cashflow", icon: TrendingUp },
      ],
    },
    {
      items: [
        { label: "Заказы", href: "/admin/orders", icon: ShoppingCart },
        { label: "Начисления", href: "/admin/charges", icon: FileText },
        { label: "Клиенты", href: "/admin/clients", icon: Building2 },
        { label: "Банковские счета", href: "/admin/bank-accounts", icon: Wallet },
        { label: "Виды работ", href: "/admin/work-types", icon: Wrench },
      ],
    },
    {
      items: [
        { label: "История действий", href: "/admin/activity", icon: History },
      ],
    },
  ],
  responsible: [
    {
      items: [
        { label: "Мои проекты", href: "/responsible/projects", icon: FolderOpen },
        { label: "Кэшфлоу", href: "/responsible/cashflow", icon: TrendingUp },
        { label: "Прочие траты", href: "/responsible/other-expenses", icon: Receipt },
      ],
    },
  ],
  executor: [
    {
      items: [
        { label: "Моя смета", href: "/me", icon: ClipboardList },
      ],
    },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  responsible: "Ответственный",
  executor: "Исполнитель",
};

type SidebarProps = {
  role: string;
  fullName: string;
  hasProjects?: boolean;
};

export function Sidebar({ role, fullName, hasProjects = true }: SidebarProps) {
  const pathname = usePathname();
  const rawGroups = NAV_CONFIG[role] ?? [];

  // У PM без проектов скрываем «Мои проекты» и «Кэшфлоу» (см. TDNB-31)
  const navGroups =
    role === "responsible" && !hasProjects
      ? rawGroups
          .map((g) => ({
            ...g,
            items: g.items.filter(
              (item) =>
                item.href !== "/responsible/projects" &&
                item.href !== "/responsible/cashflow"
            ),
          }))
          .filter((g) => g.items.length > 0)
      : rawGroups;

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-neutral-200 flex flex-col z-10">
      <div className="px-4 py-5 border-b border-neutral-200">
        <span className="text-xl font-bold text-neutral-800">КПД</span>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-4 px-2">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-neutral-200">
        <Separator className="mb-3" />
        <div className="mb-3">
          <p className="text-sm font-medium text-neutral-800 truncate">{fullName}</p>
          <p className="text-xs text-neutral-500">{ROLE_LABELS[role] ?? role}</p>
        </div>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-neutral-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </form>
      </div>
    </aside>
  );
}
