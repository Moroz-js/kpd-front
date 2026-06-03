"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EXECUTOR_COMPANY_STATUSES, EXECUTOR_TYPES, RECIPIENT_TYPES } from "@/lib/statuses";
import type { ExecutorRow } from "./ExecutorsClient";

type BankOption = { id: string; name: string; status: string };
type ResponsibleOption = { id: string; fullName: string; isActive: boolean };
type WorkTypeOption = { id: string; name: string; status: string; segment?: string };

export function ExecutorEditDialog({
  row,
  bankAccounts,
  responsibles,
  workTypes,
  onClose,
  onSaved,
}: {
  row: ExecutorRow;
  bankAccounts: BankOption[];
  responsibles: ResponsibleOption[];
  workTypes: WorkTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(row.name);
  const [companyStatus, setCompanyStatus] = React.useState(row.companyStatus ?? "");
  const [specialty, setSpecialty] = React.useState(row.specialty ?? "");
  const [contacts, setContacts] = React.useState(row.contacts ?? "");
  const [requisites, setRequisites] = React.useState(row.requisites ?? "");
  const [note, setNote] = React.useState(row.note ?? "");
  const [inTgChat, setInTgChat] = React.useState(row.inTgChat);
  const [contractFile, setContractFile] = React.useState(row.contractFile ?? "");
  const [ndaFile, setNdaFile] = React.useState(row.ndaFile ?? "");
  const [recipientType, setRecipientType] = React.useState(row.recipientType ?? "");
  const [responsibleUserId, setResponsibleUserId] = React.useState(row.responsibleUserId ?? "");
  const [defaultBankAccountId, setDefaultBankAccountId] = React.useState(
    row.defaultBankAccountId ?? ""
  );
  const [workTypeIds, setWorkTypeIds] = React.useState<string[]>(row.workTypeIds);
  const [submitting, setSubmitting] = React.useState(false);

  const isPerson = row.type === "permanent" || row.type === "external-person";
  const isService = row.type === "service";
  const typeName = EXECUTOR_TYPES[row.type as keyof typeof EXECUTOR_TYPES] ?? row.type;

  const workTypeOptions = React.useMemo(
    () =>
      workTypes
        .filter((w) => w.status === "active" || workTypeIds.includes(w.id))
        .map((w) => ({ id: w.id, name: w.name, segment: w.segment, status: w.status })),
    [workTypes, workTypeIds]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Введите имя");

    setSubmitting(true);
    const res = await fetch(`/api/executors/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        companyStatus: companyStatus || null,
        specialty: specialty || null,
        contacts: contacts || null,
        requisites: requisites || null,
        note: note || null,
        inTgChat,
        contractFile: contractFile.trim() || null,
        ndaFile: ndaFile.trim() || null,
        recipientType: recipientType || null,
        responsibleUserId: responsibleUserId || null,
        defaultBankAccountId: defaultBankAccountId || null,
        workTypeIds,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось сохранить");
      return;
    }
    toast.success("Изменения сохранены");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование: {row.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Тип:</span>
            <span className="text-xs font-medium text-neutral-700 bg-neutral-100 rounded px-2 py-0.5">{typeName}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Исполнитель <span className="font-normal text-neutral-400">(ФИО, название компании, сервиса)</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {isPerson && (
              <div className="space-y-1.5">
                <Label htmlFor="companyStatus">Статус в компании</Label>
                <Select
                  value={companyStatus || "__none__"}
                  onValueChange={(v) => setCompanyStatus(v === "__none__" ? "" : (v ?? ""))}
                >
                  <SelectTrigger id="companyStatus">
                    <SelectValue>
                      {companyStatus
                        ? (EXECUTOR_COMPANY_STATUSES[companyStatus as keyof typeof EXECUTOR_COMPANY_STATUSES] ?? companyStatus)
                        : "— Не задан —"}
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
          </div>

          <div className="space-y-1.5">
            <Label>Виды работ</Label>
            {workTypes.length === 0 ? (
              <span className="text-sm text-neutral-500">Сначала создайте виды работ</span>
            ) : (
              <WorkTypesMultiSelect
                options={workTypeOptions}
                value={workTypeIds}
                onChange={setWorkTypeIds}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsible">Ответственный (account-менеджер)</Label>
              <Select
                value={responsibleUserId || "__none__"}
                onValueChange={(v) => setResponsibleUserId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger id="responsible">
                  <SelectValue>
                    {responsibleUserId
                      ? (responsibles.find((r) => r.id === responsibleUserId)?.fullName ?? responsibleUserId)
                      : "— Не задан —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Не задан —</SelectItem>
                  {responsibles
                    .filter((r) => r.isActive || r.id === responsibleUserId)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName}
                        {!r.isActive && " (архив)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultBank">Источник оплаты</Label>
              <Select
                value={defaultBankAccountId || "__none__"}
                onValueChange={(v) =>
                  setDefaultBankAccountId(v === "__none__" ? "" : (v ?? ""))
                }
              >
                <SelectTrigger id="defaultBank">
                  <SelectValue>
                    {defaultBankAccountId
                      ? (bankAccounts.find((b) => b.id === defaultBankAccountId)?.name ?? defaultBankAccountId)
                      : "— Не задан —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Не задан —</SelectItem>
                  {bankAccounts
                    .filter((b) => b.status === "active" || b.id === defaultBankAccountId)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.status === "archived" && " (архив)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isService && <div className="space-y-1.5">
              <Label htmlFor="recipientType">Тип получателя</Label>
              <Select
                value={recipientType || "__none__"}
                onValueChange={(v) => setRecipientType(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger id="recipientType">
                  <SelectValue>
                    {recipientType || "— Не задан —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Не задан —</SelectItem>
                  {RECIPIENT_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            <div className="space-y-1.5">
              <Label htmlFor="specialty">Специальность</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requisites">Реквизиты</Label>
            <Textarea
              id="requisites"
              value={requisites}
              onChange={(e) => setRequisites(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contacts">Контакт</Label>
            <Textarea
              id="contacts"
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
              rows={2}
              placeholder="Мессенджеры, телефоны и т.п. (email — на вкладке учётной записи)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Примечание</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {!isService && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contractFile">Договор (ссылка)</Label>
                <Input
                  id="contractFile"
                  value={contractFile}
                  onChange={(e) => setContractFile(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ndaFile">NDA (ссылка)</Label>
                <Input
                  id="ndaFile"
                  value={ndaFile}
                  onChange={(e) => setNdaFile(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {!isService && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="inTgChat"
                checked={inTgChat}
                onCheckedChange={(c) => setInTgChat(!!c)}
              />
              <Label htmlFor="inTgChat" className="text-sm font-normal cursor-pointer">
                Добавлен в чат «КПД: Контент-производители»
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
