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
import {
  EXECUTOR_COMPANY_STATUSES,
  LEGAL_FORMS,
  RECIPIENT_TYPES,
} from "@/lib/statuses";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type BankOption = { id: string; name: string; status: string };
type ResponsibleOption = { id: string; fullName: string; isActive: boolean };
type WizardType = "permanent" | "external-person" | "external-legal" | "service";

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
  const [step, setStep] = React.useState<"type" | "external-kind" | "details">("type");
  const [type, setType] = React.useState<WizardType | null>(null);

  // person fields
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [companyStatus, setCompanyStatus] = React.useState<string>("");

  // legal fields
  const [legalName, setLegalName] = React.useState("");
  const [legalForm, setLegalForm] = React.useState("");

  // password (for person types)
  const [password, setPassword] = React.useState(() => generatePassword());

  // common
  const [responsibleUserId, setResponsibleUserId] = React.useState("");
  const [defaultBankAccountId, setDefaultBankAccountId] = React.useState("");
  const [recipientType, setRecipientType] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);

  function chooseType(t: WizardType | "external") {
    if (t === "external") {
      setStep("external-kind");
      return;
    }
    if (t === "permanent") {
      setType("permanent");
    } else {
      setType(t);
    }
    setStep("details");
  }

  function chooseExternalKind(kind: "person" | "legal") {
    setType(kind === "person" ? "external-person" : "external-legal");
    setStep("details");
  }

  function back() {
    if (step === "details") {
      if (type === "external-person" || type === "external-legal") setStep("external-kind");
      else setStep("type");
      return;
    }
    if (step === "external-kind") setStep("type");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;

    const payload: Record<string, unknown> = { type };

    if (type === "permanent" || type === "external-person") {
      if (!firstName.trim() || !lastName.trim()) return toast.error("Введите Имя и Фамилию");
      if (!email.trim()) return toast.error("Введите email");
      if (password.length < 6) return toast.error("Пароль не короче 6 символов");
      payload.firstName = firstName.trim();
      payload.lastName = lastName.trim();
      payload.email = email.trim();
      payload.password = password;
      if (type === "permanent" && companyStatus) payload.companyStatus = companyStatus;
    } else if (type === "external-legal") {
      if (!legalName.trim()) return toast.error("Введите название юрлица");
      if (!legalForm) return toast.error("Выберите тип юрлица");
      payload.legalName = legalName.trim();
      payload.legalForm = legalForm;
    } else {
      if (!legalName.trim()) return toast.error("Введите название");
      payload.legalName = legalName.trim();
    }

    if (responsibleUserId) payload.responsibleUserId = responsibleUserId;
    if (defaultBankAccountId) payload.defaultBankAccountId = defaultBankAccountId;
    if (recipientType) payload.recipientType = recipientType;

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
    if (type === "permanent" || type === "external-person") {
      toast.success("Исполнитель создан");
    } else {
      toast.success("Исполнитель создан");
    }
    onCreated();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "type" && "Новый исполнитель: выберите тип"}
            {step === "external-kind" && "Внешний: физлицо или юрлицо?"}
            {step === "details" && "Данные исполнителя"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              title="Постоянный"
              hint="Штатный физлицо, есть логин"
              onClick={() => chooseType("permanent")}
            />
            <TypeCard
              title="Внешний"
              hint="Подрядчик: физлицо или юрлицо"
              onClick={() => chooseType("external")}
            />
            <TypeCard
              title="Сервис"
              hint="Подписки, SaaS (MIDJOURNEY, NOTION)"
              onClick={() => chooseType("service")}
            />
          </div>
        )}

        {step === "external-kind" && (
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              title="Физлицо"
              hint="Создаём учётку"
              onClick={() => chooseExternalKind("person")}
            />
            <TypeCard
              title="Юрлицо"
              hint="ООО, ИП, АО — без логина"
              onClick={() => chooseExternalKind("legal")}
            />
          </div>
        )}

        {step === "details" && (
          <form onSubmit={submit} className="space-y-4">
            {(type === "permanent" || type === "external-person") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (логин)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Пароль</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
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
                  {password.length > 0 && password.length < 6 && (
                    <p className="text-xs text-red-600">Пароль слишком короткий</p>
                  )}
                </div>
                {type === "permanent" && (
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
              </>
            )}

            {type === "external-legal" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="legalName">Название юрлица</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Например: Рога и Копыта"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="legalForm">Тип юрлица</Label>
                  <Select value={legalForm} onValueChange={(v) => setLegalForm(v ?? "")}>
                    <SelectTrigger id="legalForm">
                      <SelectValue placeholder="ООО / ИП / АО / ...">
                        {legalForm || undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LEGAL_FORMS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {legalName && legalForm && (
                  <div className="rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm">
                    <span className="text-neutral-500">Имя: </span>
                    <span className="font-medium">
                      {legalName.trim()} {legalForm}
                    </span>
                  </div>
                )}
              </>
            )}

            {type === "service" && (
              <div className="space-y-1.5">
                <Label htmlFor="legalName">Название</Label>
                <Input
                  id="legalName"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Например: midjourney"
                  required
                  autoFocus
                />
                {type === "service" && legalName && (
                  <p className="text-xs text-neutral-500">
                    Сохранится как: <span className="font-medium">{legalName.toUpperCase()}</span>
                  </p>
                )}
              </div>
            )}

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
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultBank">Источник оплаты по умолчанию</Label>
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
                      : "— Системный по умолчанию —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Системный по умолчанию —</SelectItem>
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

            {type !== "service" && <div className="space-y-1.5">
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

        {step !== "details" && (
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
