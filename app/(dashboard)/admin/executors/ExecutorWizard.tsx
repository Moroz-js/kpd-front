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
import { RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { serializeCompanyStatus } from "@/lib/statuses";
import { RecipientTypesPicker } from "@/components/ui-custom/RecipientTypesPicker";
import { CompanyStatusPicker } from "@/components/ui-custom/CompanyStatusPicker";
import type { ExecutorType } from "@/lib/statuses";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type BankOption = { id: string; name: string; status: string };
type ResponsibleOption = { id: string; fullName: string; isActive: boolean };

export function ExecutorWizard({
  bankAccounts,
  responsibles,
  onClose,
  onCreated,
}: {
  bankAccounts: BankOption[];
  responsibles: ResponsibleOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = React.useState<"type" | "details">("type");
  const [type, setType] = React.useState<ExecutorType | null>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [companyStatuses, setCompanyStatuses] = React.useState<string[]>([]);
  const [password, setPassword] = React.useState(() => generatePassword());
  const [name, setName] = React.useState("");

  const [responsibleUserId, setResponsibleUserId] = React.useState("");
  const [defaultBankAccountId, setDefaultBankAccountId] = React.useState("");
  const [recipientTypes, setRecipientTypes] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  function chooseType(t: ExecutorType) {
    setType(t);
    setStep("details");
  }

  function back() {
    setStep("type");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;

    const payload: Record<string, unknown> = { type };

    if (type === "permanent") {
      if (!firstName.trim() || !lastName.trim()) return toast.error("Введите Имя и Фамилию");
      if (!email.trim()) return toast.error("Введите email");
      if (password.length < 6) return toast.error("Пароль не короче 6 символов");
      payload.firstName = firstName.trim();
      payload.lastName = lastName.trim();
      payload.email = email.trim();
      payload.password = password;
      const cs = serializeCompanyStatus(companyStatuses);
      if (cs) payload.companyStatus = cs;
    } else {
      if (!name.trim()) return toast.error("Введите название");
      payload.name = name.trim();
    }

    if (responsibleUserId) payload.responsibleUserId = responsibleUserId;
    if (defaultBankAccountId) payload.defaultBankAccountId = defaultBankAccountId;
    if (recipientTypes.length > 0) payload.recipientTypes = recipientTypes;

    setSubmitting(true);
    const res = await fetch("/api/executors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Не удалось создать исполнителя");
      return;
    }
    toast.success("Исполнитель создан");
    onCreated();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "type" ? "Новый исполнитель: выберите тип" : "Данные исполнителя"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              title="Постоянный"
              hint="Штатный сотрудник, есть логин"
              onClick={() => chooseType("permanent")}
            />
            <TypeCard
              title="Внешний"
              hint="Подрядчик без логина"
              onClick={() => chooseType("external")}
            />
            <TypeCard
              title="Сервис"
              hint="Подписки, SaaS"
              onClick={() => chooseType("service")}
            />
            <TypeCard
              title="Банки"
              hint="Банковские счета / операции"
              onClick={() => chooseType("bank")}
            />
          </div>
        )}

        {step === "details" && type && (
          <form onSubmit={submit} className="space-y-4">
            {type === "permanent" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="email">Email (логин)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="font-mono"
                      required
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
                <div className="space-y-1.5 min-w-0">
                  <Label>Статус в компании</Label>
                  <CompanyStatusPicker value={companyStatuses} onChange={setCompanyStatuses} />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    type === "service"
                      ? "Например: midjourney"
                      : type === "bank"
                        ? "Например: Тинькофф"
                        : "Например: Рога и Копыта"
                  }
                  required
                  autoFocus
                />
                {type === "service" && name.trim() && (
                  <p className="text-xs text-neutral-500">
                    Сохранится как: <span className="font-medium">{name.trim().toUpperCase()}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="responsible">Ответственный</Label>
              <Select
                value={responsibleUserId || "__none__"}
                onValueChange={(v) => setResponsibleUserId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger id="responsible">
                  <SelectValue>
                    {responsibleUserId
                      ? (responsibles.find((r) => r.id === responsibleUserId)?.fullName ?? "— Не задан —")
                      : "— Не задан —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Не задан —</SelectItem>
                  {responsibles
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="defaultBank">Источник оплаты по умолчанию</Label>
              <Select
                value={defaultBankAccountId || "__none__"}
                onValueChange={(v) => setDefaultBankAccountId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger id="defaultBank">
                  <SelectValue>
                    {defaultBankAccountId
                      ? (bankAccounts.find((b) => b.id === defaultBankAccountId)?.name ?? "— Не задан —")
                      : "— Не задан —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Не задан —</SelectItem>
                  {bankAccounts
                    .filter((b) => b.status === "active")
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label>Тип получателя</Label>
              <RecipientTypesPicker value={recipientTypes} onChange={setRecipientTypes} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={back} disabled={submitting}>
                Назад
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "type" && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-md border border-neutral-200 bg-white px-4 py-3 text-left hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
    >
      <span className="font-medium text-sm">{title}</span>
      <span className="text-xs text-neutral-500">{hint}</span>
    </button>
  );
}
