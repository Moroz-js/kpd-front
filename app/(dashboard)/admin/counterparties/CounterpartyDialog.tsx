"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { EntityActivityHistory } from "@/components/ui-custom/EntityActivityHistory";
import {
  COUNTERPARTY_ALIAS_SOURCES,
  COUNTERPARTY_LEGAL_TYPES,
  COUNTERPARTY_PAYMENT_METHODS,
} from "@/lib/statuses";
import { LINK_LABELS, type Counterparty, type LinkKind, type LinkOption } from "./types";

type RequisiteDraft = {
  id: string;
  isNew: boolean;
  paymentMethod: string;
  taxId: string;
  bic: string;
  bankName: string;
  accountNumber: string;
  cardNumber: string;
  comment: string;
};

type AliasDraft = { id: string; isNew: boolean; value: string; source: string };

/** Реквизиты и написания правятся тут же, поэтому у черновиков свои временные id. */
let draftSeq = 0;
const nextDraftId = () => `draft-${++draftSeq}`;

function toRequisiteDraft(r: Counterparty["requisites"][number]): RequisiteDraft {
  return {
    id: r.id,
    isNew: false,
    paymentMethod: r.paymentMethod,
    taxId: r.taxId ?? "",
    bic: r.bic ?? "",
    bankName: r.bankName ?? "",
    accountNumber: r.accountNumber ?? "",
    cardNumber: r.cardNumber ?? "",
    comment: r.comment ?? "",
  };
}

type Prefill = { name?: string; alias?: string; taxId?: string; accountNumber?: string };

/** Контрагент из операции: написание из выписки и реквизит с ИНН/счётом уже известны. */
function prefillAliases(prefill?: Prefill): AliasDraft[] {
  if (!prefill?.alias) return [];
  return [{ id: nextDraftId(), isNew: true, value: prefill.alias, source: "robot" }];
}

function prefillRequisites(prefill?: Prefill): RequisiteDraft[] {
  if (!prefill?.taxId && !prefill?.accountNumber) return [];
  return [
    {
      id: nextDraftId(),
      isNew: true,
      paymentMethod: "bank_transfer",
      taxId: prefill.taxId ?? "",
      bic: "",
      bankName: "",
      accountNumber: prefill.accountNumber ?? "",
      cardNumber: "",
      comment: "",
    },
  ];
}

export function CounterpartyDialog({
  row,
  prefill,
  executors,
  clients,
  bankAccounts,
  onClose,
  onSaved,
}: {
  row: Counterparty | null;
  /** Заготовка при создании контрагента из банковской операции. */
  prefill?: Prefill;
  executors: LinkOption[];
  clients: LinkOption[];
  bankAccounts: LinkOption[];
  onClose: () => void;
  onSaved: (counterpartyId: string) => void;
}) {
  const initialLinkKind: LinkKind = row?.clientId
    ? "client"
    : row?.bankAccountId
      ? "bankAccount"
      : "executor";

  const [linkKind, setLinkKind] = React.useState<LinkKind>(initialLinkKind);
  const [linkId, setLinkId] = React.useState(
    row?.executorId ?? row?.clientId ?? row?.bankAccountId ?? ""
  );
  const [name, setName] = React.useState(row?.name ?? prefill?.name ?? "");
  const [legalType, setLegalType] = React.useState(row?.legalType ?? "");
  const [comment, setComment] = React.useState(row?.comment ?? "");
  const [requisites, setRequisites] = React.useState<RequisiteDraft[]>(() =>
    row ? row.requisites.map(toRequisiteDraft) : prefillRequisites(prefill)
  );
  const [removedRequisites, setRemovedRequisites] = React.useState<string[]>([]);
  const [aliases, setAliases] = React.useState<AliasDraft[]>(() =>
    row
      ? row.aliases.map((a) => ({ id: a.id, isNew: false, value: a.value, source: a.source }))
      : prefillAliases(prefill)
  );
  const [removedAliases, setRemovedAliases] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const linkOptions =
    linkKind === "executor" ? executors : linkKind === "client" ? clients : bankAccounts;

  function handleLinkChange(value: string) {
    setLinkId(value);
    // Имя получателя почти всегда совпадает с названием связанной сущности.
    if (!name.trim()) {
      const picked = linkOptions.find((o) => o.id === value);
      if (picked) setName(picked.name);
    }
  }

  function addRequisite() {
    setRequisites((prev) => [
      ...prev,
      {
        id: nextDraftId(),
        isNew: true,
        paymentMethod: "bank_transfer",
        taxId: "",
        bic: "",
        bankName: "",
        accountNumber: "",
        cardNumber: "",
        comment: "",
      },
    ]);
  }

  function patchRequisite(id: string, patch: Partial<RequisiteDraft>) {
    setRequisites((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRequisite(draft: RequisiteDraft) {
    setRequisites((prev) => prev.filter((r) => r.id !== draft.id));
    if (!draft.isNew) setRemovedRequisites((prev) => [...prev, draft.id]);
  }

  function addAlias() {
    setAliases((prev) => [...prev, { id: nextDraftId(), isNew: true, value: "", source: "manual" }]);
  }

  function removeAlias(draft: AliasDraft) {
    setAliases((prev) => prev.filter((a) => a.id !== draft.id));
    if (!draft.isNew) setRemovedAliases((prev) => [...prev, draft.id]);
  }

  function requisitePayload(r: RequisiteDraft) {
    return {
      paymentMethod: r.paymentMethod,
      taxId: r.taxId.trim() || null,
      bic: r.bic.trim() || null,
      bankName: r.bankName.trim() || null,
      accountNumber: r.accountNumber.trim() || null,
      cardNumber: r.cardNumber.trim() || null,
      comment: r.comment.trim() || null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!linkId) {
      toast.error(`Выберите, на что ссылается контрагент: ${LINK_LABELS[linkKind]}`);
      return;
    }
    if (!name.trim()) {
      toast.error("Введите название контрагента");
      return;
    }

    setSubmitting(true);
    try {
      const links = {
        executorId: linkKind === "executor" ? linkId : null,
        clientId: linkKind === "client" ? linkId : null,
        bankAccountId: linkKind === "bankAccount" ? linkId : null,
      };

      let counterpartyId = row?.id ?? "";
      if (row) {
        const res = await fetch(`/api/counterparties/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            legalType: legalType || null,
            comment: comment.trim() || null,
            ...links,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Не удалось сохранить");
      } else {
        const res = await fetch("/api/counterparties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            legalType: legalType || null,
            comment: comment.trim() || null,
            ...links,
            requisites: requisites.map(requisitePayload),
            aliases: aliases
              .filter((a) => a.value.trim())
              .map((a) => ({ value: a.value.trim(), source: a.source })),
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Не удалось сохранить");
        counterpartyId = (await res.json()).id;
      }

      if (row) {
        for (const id of removedRequisites) {
          await fetch(`/api/counterparties/requisites/${id}`, { method: "DELETE" });
        }
        for (const r of requisites) {
          if (r.isNew) {
            await fetch(`/api/counterparties/${counterpartyId}/requisites`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requisitePayload(r)),
            });
          } else {
            await fetch(`/api/counterparties/requisites/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requisitePayload(r)),
            });
          }
        }
        for (const id of removedAliases) {
          await fetch(`/api/counterparties/aliases/${id}`, { method: "DELETE" });
        }
        for (const a of aliases) {
          if (!a.isNew || !a.value.trim()) continue;
          const res = await fetch(`/api/counterparties/${counterpartyId}/aliases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: a.value.trim(), source: a.source }),
          });
          if (res.status === 409) {
            toast.error((await res.json()).error);
          }
        }
      }

      toast.success(row ? "Контрагент обновлён" : "Контрагент создан");
      onSaved(counterpartyId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? "Контрагент" : "Новый контрагент"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ссылается на</Label>
              <div className="flex gap-1">
                {(Object.keys(LINK_LABELS) as LinkKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setLinkKind(kind);
                      setLinkId("");
                    }}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      linkKind === kind
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    {LINK_LABELS[kind]}
                  </button>
                ))}
              </div>
              <SearchableSelect
                value={linkId}
                onValueChange={handleLinkChange}
                options={linkOptions.map((o) => ({
                  value: o.id,
                  label: o.name,
                  searchText: o.name,
                }))}
                placeholder={`Выберите: ${LINK_LABELS[linkKind].toLowerCase()}`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-name">Название (юридический получатель)</Label>
              <Input
                id="cp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ИП Дубровская Светлана"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Юрлицо</Label>
              <SearchableSelect
                value={legalType}
                onValueChange={setLegalType}
                options={Object.entries(COUNTERPARTY_LEGAL_TYPES).map(([value, label]) => ({
                  value,
                  label,
                }))}
                placeholder="Не указано"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-comment">Комментарий</Label>
              <Input
                id="cp-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">
                Реквизиты — куда переводим
              </h3>
              <Button type="button" size="sm" variant="ghost" onClick={addRequisite}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Реквизит
              </Button>
            </div>
            {requisites.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Реквизитов нет. Два счёта одного ИП — это две строки здесь, а не два контрагента.
              </p>
            ) : (
              <div className="space-y-3">
                {requisites.map((r) => (
                  <div key={r.id} className="rounded-md border border-neutral-200 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="w-48">
                        <SearchableSelect
                          value={r.paymentMethod}
                          onValueChange={(v) => patchRequisite(r.id, { paymentMethod: v })}
                          options={Object.entries(COUNTERPARTY_PAYMENT_METHODS).map(
                            ([value, label]) => ({ value, label })
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => removeRequisite(r)}
                        title="Удалить реквизит"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={r.taxId}
                        onChange={(e) => patchRequisite(r.id, { taxId: e.target.value })}
                        placeholder="ИНН / ИИК / IBAN"
                      />
                      <Input
                        value={r.bic}
                        onChange={(e) => patchRequisite(r.id, { bic: e.target.value })}
                        placeholder="БИК"
                      />
                      <Input
                        value={r.bankName}
                        onChange={(e) => patchRequisite(r.id, { bankName: e.target.value })}
                        placeholder="Банк"
                      />
                      <Input
                        value={r.accountNumber}
                        onChange={(e) => patchRequisite(r.id, { accountNumber: e.target.value })}
                        placeholder="Номер счёта"
                      />
                      <Input
                        value={r.cardNumber}
                        onChange={(e) => patchRequisite(r.id, { cardNumber: e.target.value })}
                        placeholder="Номер карты"
                      />
                      <Input
                        value={r.comment}
                        onChange={(e) => patchRequisite(r.id, { comment: e.target.value })}
                        placeholder="Комментарий"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">Имена в выписке</h3>
              <Button type="button" size="sm" variant="ghost" onClick={addAlias}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Написание
              </Button>
            </div>
            {aliases.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Написаний нет. ИНН и номера счетов сюда не дублируются — они в реквизитах и
                работают признаком распознавания сами по себе.
              </p>
            ) : (
              <div className="space-y-2">
                {aliases.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Input
                      value={a.value}
                      onChange={(e) =>
                        setAliases((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, value: e.target.value } : x))
                        )
                      }
                      placeholder="ЛОЙМ АЛЕКСАНДР"
                      disabled={!a.isNew}
                    />
                    <div className="w-52 shrink-0">
                      <SearchableSelect
                        value={a.source}
                        onValueChange={(v) =>
                          setAliases((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, source: v } : x))
                          )
                        }
                        options={Object.entries(COUNTERPARTY_ALIAS_SOURCES).map(
                          ([value, label]) => ({ value, label })
                        )}
                        disabled={!a.isNew}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAlias(a)}
                      title="Удалить написание"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {row && <EntityActivityHistory entityType="Counterparty" entityId={row.id} />}

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
