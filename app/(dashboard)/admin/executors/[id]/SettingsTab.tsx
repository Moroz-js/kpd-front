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
import { Checkbox } from "@/components/ui/checkbox";
import { WorkTypesMultiSelect } from "@/components/ui-custom/WorkTypesMultiSelect";
import { RECIPIENT_TYPES, WORK_TYPE_SEGMENTS } from "@/lib/statuses";

type BankAccount = { id: string; name: string };
type WorkType = { id: string; name: string; segment?: string };
type Project = { id: string; name: string; status: string };

  type ExecutorDetail = {
  id: string;
  name: string;
  type: string;
  status: string;
  accessRevokedAt: string | null;
  contacts: string | null;
  requisites: string | null;
  recipientType: string | null;
  defaultBankAccountId: string | null;
  specialties: string | null;
  entityForm: string | null;
  isResponsible: boolean;
  responsibleActive: boolean;
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
  const isService = executor.type === "service";
  const [fullName, setFullName] = useState(executor.user?.fullName ?? executor.name);
  const [email, setEmail] = useState(executor.user?.email ?? "");
  const [contacts, setContacts] = useState(executor.contacts ?? "");
  const [requisites, setRequisites] = useState(executor.requisites ?? "");
  const [recipientType, setRecipientType] = useState(executor.recipientType ?? "");
  const [defaultBankAccountId, setDefaultBankAccountId] = useState(executor.defaultBankAccountId ?? "");
  const [entityForm, setEntityForm] = useState(executor.entityForm ?? "");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(() => {
    try { return JSON.parse(executor.specialties ?? "[]"); } catch { return []; }
  });
  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<string[]>(
    executor.executorWorkTypes.map((ewt) => ewt.workType.id)
  );
  const [isResponsible, setIsResponsible] = useState(executor.isResponsible ?? false);
  const executorArchived = executor.status === "archived";
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
          name: fullName.trim(),
          contacts: contacts || null,
          requisites: requisites || null,
          recipientType: recipientType || null,
          defaultBankAccountId: defaultBankAccountId || null,
          entityForm: entityForm || null,
          specialties: JSON.stringify(selectedSpecialties),
          isResponsible,
          workTypeIds: selectedWorkTypeIds,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Ошибка сохранения");
      }

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
      setIsResponsible(executor.isResponsible ?? false);
    } finally {
      setSaving(false);
    }
  }

  function toggleSpecialty(s: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {!isService && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Доступ к системе</h3>
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-sm font-medium ${hasAccess ? "text-green-700" : "text-red-600"}`}>
                {hasAccess ? "Доступ активен" : "Доступ отозван"}
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
      )}

      {/* Profile block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Профиль</h3>
        {(executor.user || isService) && (
          <div className="space-y-1.5">
            <Label>Исполнитель <span className="font-normal text-neutral-400">(ФИО, название компании, сервиса и т.д.)</span></Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        )}
        {executor.user && (
          <div className="space-y-1.5">
            <Label>Email (логин)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Контакты</Label>
          <Input
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            placeholder="Телеграм, телефон и т.д."
          />
        </div>
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isResponsible"
              checked={isResponsible}
              disabled={executorArchived}
              onCheckedChange={(v) => setIsResponsible(Boolean(v))}
            />
            <Label
              htmlFor="isResponsible"
              className={executorArchived ? "text-neutral-400" : "cursor-pointer"}
            >
              Является ответственным
            </Label>
          </div>
          {executorArchived && (
            <p className="text-xs text-neutral-500 pl-6">
              Архивного исполнителя нельзя назначить ответственным. Статус ответственного меняется в разделе «Ответственные».
            </p>
          )}
          {isResponsible && !executorArchived && executor.isResponsible && !executor.responsibleActive && (
            <p className="text-xs text-amber-700 pl-6">
              Роль ответственного в архиве — исполнитель при этом может оставаться активным.
            </p>
          )}
        </div>
      </div>

      {/* Payment block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Оплата</h3>
        <div className="space-y-1.5">
          <Label>Реквизиты</Label>
          <Input value={requisites} onChange={(e) => setRequisites(e.target.value)} placeholder="ИНН, расчётный счёт и т.д." />
        </div>
        <div className="space-y-1.5">
          <Label>Форма юридического лица</Label>
          <Input
            value={entityForm}
            onChange={(e) => setEntityForm(e.target.value)}
            placeholder="ИП, ООО, ОАО, самозанятый и т.д."
            list="entity-form-options"
          />
          <datalist id="entity-form-options">
            {["ИП", "ООО", "ОАО", "ПАО", "АО", "Самозанятый", "Физлицо"].map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label>Источник оплаты по умолчанию</Label>
          <Select value={defaultBankAccountId} onValueChange={(v) => setDefaultBankAccountId(v ?? "")}>
            <SelectTrigger>
              <SelectValue>
                {defaultBankAccountId
                  ? (bankAccounts.find((b) => b.id === defaultBankAccountId)?.name ?? "—")
                  : "— Не задан —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Не задан —</SelectItem>
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

      {/* Specialties block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Специальности</h3>
        <div className="flex flex-wrap gap-2">
          {WORK_TYPE_SEGMENTS.map((seg) => {
            const selected = selectedSpecialties.includes(seg);
            return (
              <button
                key={seg}
                type="button"
                onClick={() => toggleSpecialty(seg)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-violet-100 border-violet-300 text-violet-800"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {seg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Work types block */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Виды работ</h3>
        {allWorkTypes.length === 0 ? (
          <span className="text-xs text-neutral-400">Нет доступных видов работ</span>
        ) : (
          <WorkTypesMultiSelect
            options={allWorkTypes.map((wt) => ({
              id: wt.id,
              name: wt.name,
              segment: wt.segment,
            }))}
            value={selectedWorkTypeIds}
            onChange={setSelectedWorkTypeIds}
          />
        )}
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
          Чтобы добавить проект исполнителю, руководитель должен добавить строку с этим исполнителем в план расходов проекта.
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
