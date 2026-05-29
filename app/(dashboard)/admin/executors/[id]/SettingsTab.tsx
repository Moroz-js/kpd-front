"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RECIPIENT_TYPES } from "@/lib/statuses";

type BankAccount = { id: string; name: string };
type WorkType = { id: string; name: string };
type Project = { id: string; name: string; status: string };

type ExecutorDetail = {
  id: string;
  name: string;
  status: string;
  accessRevokedAt: string | null;
  contacts: string | null;
  requisites: string | null;
  recipientType: string | null;
  defaultBankAccountId: string | null;
  onboardingSeeded: boolean;
  user: { id: string; email: string; fullName: string; isActive: boolean } | null;
  executorWorkTypes: { workType: WorkType }[];
  projectExecutors: { project: Project }[];
};

type Props = {
  executorId: string;
  executor: ExecutorDetail;
  bankAccounts: BankAccount[];
  allWorkTypes: WorkType[];
  onChanged: () => void;
};

export function SettingsTab({ executorId, executor, bankAccounts, allWorkTypes, onChanged }: Props) {
  const [fullName, setFullName] = useState(executor.user?.fullName ?? executor.name);
  const [email, setEmail] = useState(executor.user?.email ?? "");
  const [contacts, setContacts] = useState(executor.contacts ?? "");
  const [requisites, setRequisites] = useState(executor.requisites ?? "");
  const [recipientType, setRecipientType] = useState(executor.recipientType ?? "");
  const [defaultBankAccountId, setDefaultBankAccountId] = useState(executor.defaultBankAccountId ?? "");
  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<string[]>(
    executor.executorWorkTypes.map((ewt) => ewt.workType.id)
  );
  const [saving, setSaving] = useState(false);

  // Access toggle
  const [togglingAccess, setTogglingAccess] = useState(false);
  const hasAccess = !executor.accessRevokedAt;

  async function handleToggleAccess() {
    setTogglingAccess(true);
    try {
      const r = await fetch(`/api/executors/${executorId}/access`, {
        method: hasAccess ? "DELETE" : "POST",
      });
      if (!r.ok) throw new Error();
      toast.success(hasAccess ? "Доступ отозван" : "Доступ выдан");
      onChanged();
    } catch {
      toast.error("Не удалось изменить доступ");
    } finally {
      setTogglingAccess(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/executors/${executorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: contacts || null,
          requisites: requisites || null,
          recipientType: recipientType || null,
          defaultBankAccountId: defaultBankAccountId || null,
          workTypeIds: selectedWorkTypeIds,
        }),
      });
      if (!r.ok) throw new Error();

      // Update user fields if exists
      if (executor.user) {
        const ur = await fetch(`/api/users/${executor.user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: fullName || undefined, email: email || undefined }),
        });
        if (!ur.ok) throw new Error("Ошибка обновления пользователя");
      }

      toast.success("Настройки сохранены");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  function toggleWorkType(id: string) {
    setSelectedWorkTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Access block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Доступ к системе</h3>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-neutral-600">
              Статус:{" "}
              <strong className={hasAccess ? "text-green-700" : "text-red-600"}>
                {hasAccess ? "Активен" : "Отозван"}
              </strong>
            </span>
            {executor.user?.email && (
              <p className="text-xs text-neutral-400 mt-0.5">Логин: {executor.user.email}</p>
            )}
          </div>
          {executor.user && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAccess}
              disabled={togglingAccess}
              className={hasAccess ? "border-red-300 text-red-600 hover:bg-red-50" : "border-green-300 text-green-700 hover:bg-green-50"}
            >
              {hasAccess ? "Отозвать доступ" : "Выдать доступ"}
            </Button>
          )}
        </div>
      </div>

      {/* Profile block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Профиль</h3>
        {executor.user && (
          <>
            <div className="space-y-1.5">
              <Label>ФИО</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (логин)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label>Контакты</Label>
          <Input
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            placeholder="Телеграм, телефон и т.д."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Реквизиты</Label>
          <Input value={requisites} onChange={(e) => setRequisites(e.target.value)} placeholder="ИНН, расчётный счёт и т.д." />
        </div>
      </div>

      {/* Payment block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Оплата</h3>
        <div className="space-y-1.5">
          <Label>Источник оплаты по умолчанию</Label>
          <Select value={defaultBankAccountId} onValueChange={(v) => setDefaultBankAccountId(v ?? "")}>
            <SelectTrigger>
              <SelectValue>
                {defaultBankAccountId
                  ? (bankAccounts.find((b) => b.id === defaultBankAccountId)?.name ?? "—")
                  : "— Системный по умолчанию —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Системный по умолчанию —</SelectItem>
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Тип получателя</Label>
          <Select value={recipientType || "__none__"} onValueChange={(v) => setRecipientType(v === "__none__" ? "" : (v ?? ""))}>
            <SelectTrigger>
              <SelectValue>
                {recipientType || "— Не задан —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Не задан —</SelectItem>
              {RECIPIENT_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>{rt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Work types block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Виды работ</h3>
        <div className="flex flex-wrap gap-2">
          {allWorkTypes.map((wt) => {
            const selected = selectedWorkTypeIds.includes(wt.id);
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => toggleWorkType(wt.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-blue-100 border-blue-300 text-blue-800"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {wt.name}
              </button>
            );
          })}
          {allWorkTypes.length === 0 && (
            <span className="text-xs text-neutral-400">Нет доступных видов работ</span>
          )}
        </div>
      </div>

      {/* Projects block — read-only */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Проекты</h3>
        {executor.projectExecutors.length === 0 ? (
          <p className="text-xs text-neutral-400">Исполнитель не добавлен ни в один проект</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {executor.projectExecutors.map(({ project }) => (
              <span
                key={project.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  project.status === "active"
                    ? "bg-neutral-100 border-neutral-200 text-neutral-700"
                    : "bg-slate-100 border-slate-200 text-slate-500"
                }`}
              >
                {project.name}
                {project.status === "archived" && " (архив)"}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-neutral-400">
          Чтобы добавить проект — откройте его в разделе «Проекты» и добавьте исполнителя.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </Button>
      </div>
    </div>
  );
}
