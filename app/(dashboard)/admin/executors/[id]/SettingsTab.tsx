"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkTypesMultiSelect } from "@/components/ui-custom/WorkTypesMultiSelect";
import { RecipientTypesPicker } from "@/components/ui-custom/RecipientTypesPicker";
import { EXECUTOR_COMPANY_STATUSES, EXECUTOR_TYPES, WORK_TYPE_SEGMENTS, formatCompanyStatus } from "@/lib/statuses";
import { parseRecipientTypes } from "@/lib/executor-recipient-type";
import {
  canBeResponsible,
  EXECUTOR_TYPE_OPTIONS,
  normalizeExecutorType,
} from "@/lib/executor-type";
import type { ExecutorType } from "@/lib/statuses";
import { RefreshCw, X } from "lucide-react";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type BankAccount = { id: string; name: string };
type WorkType = { id: string; name: string; segment?: string };
type PlanProject = { id: string; name: string };

type ExecutorDetail = {
  id: string;
  name: string;
  type: string;
  status: string;
  companyStatus: string | null;
  accessRevokedAt: string | null;
  contacts: string | null;
  requisites: string | null;
  recipientType: string | null;
  defaultBankAccountId: string | null;
  specialties: string | null;
  contractFile: string | null;
  ndaFile: string | null;
  note: string | null;
  inTgChat: boolean;
  isResponsible: boolean;
  responsibleActive: boolean;
  user: { id: string; email: string; fullName: string; isActive: boolean } | null;
  executorWorkTypes: { workType: WorkType }[];
};

type Props = {
  executorId: string;
  executor: ExecutorDetail;
  bankAccounts: BankAccount[];
  allWorkTypes: WorkType[];
  onChanged: () => void;
  /** Полный доступ: смена типа, учётка, доступ, роль ответственного. */
  isAdmin?: boolean;
  /** Владелец профиля (свой /me): может сменить свой пароль. */
  isOwner?: boolean;
};

export function SettingsTab({
  executorId,
  executor,
  bankAccounts,
  allWorkTypes,
  onChanged,
  isAdmin = false,
  isOwner = false,
}: Props) {
  const [executorType, setExecutorType] = useState<ExecutorType>(() =>
    normalizeExecutorType(executor.type)
  );
  const isPermanent = executorType === "permanent";
  const isService = executorType === "service";
  const needsAccount = isPermanent && !executor.user;

  const [fullName, setFullName] = useState(executor.user?.fullName ?? executor.name);
  const [email, setEmail] = useState(executor.user?.email ?? "");
  const [password, setPassword] = useState(() => generatePassword());
  const [companyStatus, setCompanyStatus] = useState(executor.companyStatus ?? "");
  const [contacts, setContacts] = useState(executor.contacts ?? "");
  const [requisites, setRequisites] = useState(executor.requisites ?? "");
  const [note, setNote] = useState(executor.note ?? "");
  const [contractFile, setContractFile] = useState(executor.contractFile ?? "");
  const [ndaFile, setNdaFile] = useState(executor.ndaFile ?? "");
  const [inTgChat, setInTgChat] = useState(executor.inTgChat);
  const [recipientTypes, setRecipientTypes] = useState<string[]>(() =>
    parseRecipientTypes(executor.recipientType)
  );
  const [defaultBankAccountId, setDefaultBankAccountId] = useState(
    executor.defaultBankAccountId ?? ""
  );
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(() => {
    try {
      return JSON.parse(executor.specialties ?? "[]");
    } catch {
      return [];
    }
  });
  const [selectedWorkTypeIds, setSelectedWorkTypeIds] = useState<string[]>(
    executor.executorWorkTypes.map((ewt) => ewt.workType.id)
  );
  const [isResponsible, setIsResponsible] = useState(executor.isResponsible ?? false);
  const executorArchived = executor.status === "archived";
  const [planProjects, setPlanProjects] = useState<PlanProject[]>([]);
  const [loadingPlanProjects, setLoadingPlanProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);
  const hasAccess = !executor.accessRevokedAt;

  // Смена собственного пароля (только владелец профиля)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleChangePassword() {
    if (newPassword.length < 6) return toast.error("Новый пароль не короче 6 символов");
    setChangingPassword(true);
    try {
      const r = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Не удалось сменить пароль");
      }
      toast.success("Пароль изменён");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setChangingPassword(false);
    }
  }

  useEffect(() => {
    setExecutorType(normalizeExecutorType(executor.type));
    setFullName(executor.user?.fullName ?? executor.name);
    setEmail(executor.user?.email ?? "");
    setCompanyStatus(executor.companyStatus ?? "");
    setContacts(executor.contacts ?? "");
    setRequisites(executor.requisites ?? "");
    setNote(executor.note ?? "");
    setContractFile(executor.contractFile ?? "");
    setNdaFile(executor.ndaFile ?? "");
    setInTgChat(executor.inTgChat);
    setRecipientTypes(parseRecipientTypes(executor.recipientType));
    setDefaultBankAccountId(executor.defaultBankAccountId ?? "");
    setIsResponsible(executor.isResponsible ?? false);
    setSelectedWorkTypeIds(executor.executorWorkTypes.map((ewt) => ewt.workType.id));
    try {
      setSelectedSpecialties(JSON.parse(executor.specialties ?? "[]"));
    } catch {
      setSelectedSpecialties([]);
    }
  }, [executor]);

  useEffect(() => {
    setLoadingPlanProjects(true);
    fetch(`/api/executors/${executorId}/plan-projects`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: PlanProject[]) => setPlanProjects(list))
      .catch(() => setPlanProjects([]))
      .finally(() => setLoadingPlanProjects(false));
  }, [executorId]);

  function handleTypeChange(next: ExecutorType) {
    setExecutorType(next);
    if (!canBeResponsible(next)) setIsResponsible(false);
  }

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
    if (needsAccount) {
      if (!email.trim()) return toast.error("Введите email");
      if (password.length < 6) return toast.error("Пароль не короче 6 символов");
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: executorType,
        name: fullName.trim(),
        companyStatus: isPermanent ? companyStatus || null : null,
        contacts: contacts || null,
        requisites: requisites || null,
        note: note || null,
        inTgChat: isService ? false : inTgChat,
        contractFile: isService ? null : contractFile.trim() || null,
        ndaFile: isService ? null : ndaFile.trim() || null,
        recipientTypes,
        defaultBankAccountId: defaultBankAccountId || null,
        specialties: JSON.stringify(selectedSpecialties),
        isResponsible: canBeResponsible(executorType) ? isResponsible : false,
        workTypeIds: selectedWorkTypeIds,
      };
      if (needsAccount) {
        payload.email = email.trim();
        payload.password = password;
      }

      const r = await fetch(`/api/executors/${executorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Ошибка сохранения");
      }

      if ((isAdmin || isOwner) && executor.user) {
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
      setExecutorType(normalizeExecutorType(executor.type));
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
      {isAdmin && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Тип исполнителя</h3>
          <Select
            value={executorType}
            onValueChange={(v) => v && handleTypeChange(v as ExecutorType)}
          >
            <SelectTrigger>
              <SelectValue>{EXECUTOR_TYPES[executorType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EXECUTOR_TYPE_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isAdmin && needsAccount && (
        <div className="border border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50/40">
          <h3 className="text-sm font-semibold text-neutral-800">Учётная запись</h3>
          <p className="text-xs text-neutral-500">
            Для постоянного исполнителя нужен логин — после сохранения появится смета и онбординг.
          </p>
          <div className="space-y-1.5">
            <Label>Email (логин) *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="executor@company.ru"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Пароль *</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPassword(generatePassword())}
                title="Сгенерировать"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && !isService && executor.user && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Доступ к системе</h3>
          <div className="flex items-center justify-between">
            <div>
              <span
                className={`text-sm font-medium ${hasAccess ? "text-green-700" : "text-red-600"}`}
              >
                {hasAccess ? "Доступ активен" : "Доступ отозван"}
              </span>
              {executor.user.email && (
                <p className="text-xs text-neutral-400 mt-0.5">Логин: {executor.user.email}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAccess}
              disabled={togglingAccess}
              className={
                hasAccess
                  ? "border-red-300 text-red-600 hover:bg-red-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }
            >
              {hasAccess ? "Отозвать доступ" : "Выдать доступ"}
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Профиль</h3>
        <div className="space-y-1.5">
          <Label>
            Исполнитель{" "}
            <span className="font-normal text-neutral-400">
              (ФИ, название компании, сервиса и т.д.)
            </span>
          </Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          {isService && fullName.trim() && (
            <p className="text-xs text-neutral-500">
              Сохранится как: <span className="font-medium">{fullName.trim().toUpperCase()}</span>
            </p>
          )}
        </div>
        {isAdmin && executor.user && (
          <div className="space-y-1.5">
            <Label>Email (логин)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {isPermanent && (
          <div className="space-y-1.5">
            <Label>Статус в компании</Label>
            <Select
              value={companyStatus || "__none__"}
              onValueChange={(v) => setCompanyStatus(v === "__none__" ? "" : (v ?? ""))}
            >
              <SelectTrigger>
                <SelectValue>
                  {companyStatus ? formatCompanyStatus(companyStatus) : "— Не задан —"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Не задан —</SelectItem>
                {Object.entries(EXECUTOR_COMPANY_STATUSES).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        {isAdmin && canBeResponsible(executorType) && (
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
                Назначить руководителем проекта
              </Label>
            </div>
            {executorArchived && (
              <p className="text-xs text-neutral-500 pl-6">
                Архивного исполнителя нельзя назначить руководителем проекта.
              </p>
            )}
            {isResponsible &&
              !executorArchived &&
              executor.isResponsible &&
              !executor.responsibleActive && (
                <p className="text-xs text-amber-700 pl-6">
                  Роль руководителя проекта в архиве — исполнитель при этом может оставаться активным.
                </p>
              )}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Оплата</h3>
        <div className="space-y-1.5">
          <Label>Реквизиты</Label>
          <Input
            value={requisites}
            onChange={(e) => setRequisites(e.target.value)}
            placeholder="ИНН, расчётный счёт и т.д."
          />
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
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Тип получателя</Label>
          <RecipientTypesPicker value={recipientTypes} onChange={setRecipientTypes} />
        </div>
      </div>

      {!isService && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Документы</h3>
          <div className="space-y-1.5">
            <Label>Договор (ссылка)</Label>
            <Input
              value={contractFile}
              onChange={(e) => setContractFile(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>NDA (ссылка)</Label>
            <Input
              value={ndaFile}
              onChange={(e) => setNdaFile(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="inTgChat"
              checked={inTgChat}
              onCheckedChange={(v) => setInTgChat(Boolean(v))}
            />
            <Label htmlFor="inTgChat" className="cursor-pointer">
              В чате Telegram
            </Label>
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Примечание</h3>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Внутренние заметки"
        />
      </div>

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

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Виды работ</h3>
        {selectedWorkTypeIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedWorkTypeIds.map((id) => {
              const wt = allWorkTypes.find((w) => w.id === id);
              if (!wt) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700"
                >
                  {wt.name}
                  <button
                    type="button"
                    onClick={() => setSelectedWorkTypeIds(selectedWorkTypeIds.filter((x) => x !== id))}
                    className="ml-0.5 rounded-full hover:bg-neutral-300 p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
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

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Проекты</h3>
        {loadingPlanProjects ? (
          <p className="text-xs text-neutral-400">Загрузка…</p>
        ) : planProjects.length === 0 ? (
          <p className="text-xs text-neutral-400">
            Нет проектов в плане расходов. Руководитель добавляет строку с этим исполнителем в
            дашборде проекта.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {planProjects.map((project) => (
              <span
                key={project.id}
                className="rounded-full border px-3 py-1 text-xs font-medium bg-neutral-100 border-neutral-200 text-neutral-700"
              >
                {project.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </Button>
      </div>

      {isOwner && executor.user && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Сменить пароль</h3>
          <div className="space-y-1.5">
            <Label>Текущий пароль</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Новый пароль</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Не короче 6 символов"
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || newPassword.length < 6}
            >
              {changingPassword ? "Сохранение..." : "Изменить пароль"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
