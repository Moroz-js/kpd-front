/**
 * RecognitionRuleService — правила разбора выписки.
 *
 * Одна таблица на все три подстановки (контрагент, проект, вид работ): у правила
 * есть поле выписки, по которому оно срабатывает, значение и то, что подставляем.
 * Блок «запомнить выбор» в карточке операции пишет строку сюда, поэтому правила
 * появляются из обычной работы бухгалтера, а не из отдельного экрана.
 *
 * Применение правил к новым выпискам — этап «робот»; здесь только хранение,
 * приоритет, включение и счётчик срабатываний.
 */

import { prisma } from "@/lib/db";
import { logActivity, diff } from "@/lib/audit/log";
import { normalizeByMatchField } from "@/lib/counterparty-match";
import { RULE_MATCH_FIELDS, RULE_TARGETS } from "@/lib/statuses";

export type RecognitionRuleRow = {
  id: string;
  target: string;
  matchField: string;
  matchValue: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  projectId: string | null;
  projectName: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  priority: number;
  isActive: boolean;
  hitCount: number;
  lastUsedAt: Date | null;
  source: string;
  comment: string | null;
  createdByName: string | null;
  createdAt: Date;
};

const RULE_INCLUDE = {
  counterparty: { select: { name: true } },
  project: { select: { name: true } },
  workType: { select: { name: true } },
  createdBy: { select: { fullName: true } },
} as const;

export async function listRecognitionRules(): Promise<RecognitionRuleRow[]> {
  const rules = await prisma.recognitionRule.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    include: RULE_INCLUDE,
  });

  return rules.map((r) => ({
    id: r.id,
    target: r.target,
    matchField: r.matchField,
    matchValue: r.matchValue,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty?.name ?? null,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    workTypeId: r.workTypeId,
    workTypeName: r.workType?.name ?? null,
    priority: r.priority,
    isActive: r.isActive,
    hitCount: r.hitCount,
    lastUsedAt: r.lastUsedAt,
    source: r.source,
    comment: r.comment,
    createdByName: r.createdBy?.fullName ?? null,
    createdAt: r.createdAt,
  }));
}

export type CreateRecognitionRuleInput = {
  target: string;
  matchField: string;
  matchValue: string;
  counterpartyId?: string | null;
  projectId?: string | null;
  workTypeId?: string | null;
  priority?: number;
  comment?: string | null;
  source?: string;
};

function assertTargetFilled(input: CreateRecognitionRuleInput) {
  const targets: Record<string, string | null | undefined> = {
    counterparty: input.counterpartyId,
    project: input.projectId,
    work_type: input.workTypeId,
  };
  if (!targets[input.target]) {
    throw new Error(`Правило «${RULE_TARGETS[input.target as keyof typeof RULE_TARGETS] ?? input.target}» без значения для подстановки`);
  }
}

/**
 * Создаёт правило. Признак уникален в пределах пары «что подставляем + поле»:
 * два ответа на один признак сделали бы автоопределение неоднозначным, поэтому
 * повторное правило переписывает подстановку, а не плодит дубль.
 */
export async function upsertRecognitionRule(
  input: CreateRecognitionRuleInput,
  userId: string
) {
  assertTargetFilled(input);

  const normalizedValue = normalizeByMatchField(input.matchField, input.matchValue);
  if (!normalizedValue) throw new Error("Пустое значение признака");

  const existing = await prisma.recognitionRule.findUnique({
    where: {
      target_matchField_normalizedValue: {
        target: input.target,
        matchField: input.matchField,
        normalizedValue,
      },
    },
  });

  const data = {
    target: input.target,
    matchField: input.matchField,
    matchValue: input.matchValue.trim(),
    normalizedValue,
    counterpartyId: input.counterpartyId ?? null,
    projectId: input.projectId ?? null,
    workTypeId: input.workTypeId ?? null,
    ...(input.priority !== undefined && { priority: input.priority }),
    ...(input.comment !== undefined && { comment: input.comment?.trim() || null }),
    ...(input.source !== undefined && { source: input.source }),
  };

  if (existing) {
    const updated = await prisma.recognitionRule.update({ where: { id: existing.id }, data });
    const changes = diff(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );
    if (Object.keys(changes).length > 0) {
      await logActivity({
        userId,
        action: "update",
        entityType: "RecognitionRule",
        entityId: updated.id,
        entityLabel: ruleLabel(updated),
        changes,
      });
    }
    return updated;
  }

  const created = await prisma.recognitionRule.create({
    data: { ...data, createdById: userId },
  });

  await logActivity({
    userId,
    action: "create",
    entityType: "RecognitionRule",
    entityId: created.id,
    entityLabel: ruleLabel(created),
  });

  return created;
}

export type UpdateRecognitionRuleInput = {
  matchValue?: string;
  counterpartyId?: string | null;
  projectId?: string | null;
  workTypeId?: string | null;
  priority?: number;
  isActive?: boolean;
  comment?: string | null;
};

export async function updateRecognitionRule(
  id: string,
  patch: UpdateRecognitionRuleInput,
  userId: string
) {
  const before = await prisma.recognitionRule.findUnique({ where: { id } });
  if (!before) throw new Error("Rule not found");

  const updated = await prisma.recognitionRule.update({
    where: { id },
    data: {
      ...(patch.matchValue !== undefined && {
        matchValue: patch.matchValue.trim(),
        normalizedValue: normalizeByMatchField(before.matchField, patch.matchValue),
      }),
      ...(patch.counterpartyId !== undefined && { counterpartyId: patch.counterpartyId }),
      ...(patch.projectId !== undefined && { projectId: patch.projectId }),
      ...(patch.workTypeId !== undefined && { workTypeId: patch.workTypeId }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      ...(patch.comment !== undefined && { comment: patch.comment?.trim() || null }),
    },
  });

  const changes = diff(
    before as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );
  if (Object.keys(changes).length > 0) {
    await logActivity({
      userId,
      action: "update",
      entityType: "RecognitionRule",
      entityId: id,
      entityLabel: ruleLabel(updated),
      changes,
    });
  }

  return updated;
}

export async function deleteRecognitionRule(id: string, userId: string) {
  const before = await prisma.recognitionRule.findUnique({ where: { id } });
  if (!before) throw new Error("Rule not found");

  await prisma.$transaction(async (tx) => {
    // Операции, распознанные этим правилом, ссылку теряют — трассировка остаётся текстом.
    await tx.bankOperation.updateMany({
      where: { counterpartyRuleId: id },
      data: { counterpartyRuleId: null },
    });
    await tx.recognitionRule.delete({ where: { id } });
  });

  await logActivity({
    userId,
    action: "delete",
    entityType: "RecognitionRule",
    entityId: id,
    entityLabel: ruleLabel(before),
  });
}

export function ruleLabel(rule: { target: string; matchField: string; matchValue: string }): string {
  const target = RULE_TARGETS[rule.target as keyof typeof RULE_TARGETS] ?? rule.target;
  const field = RULE_MATCH_FIELDS[rule.matchField as keyof typeof RULE_MATCH_FIELDS] ?? rule.matchField;
  return `${target}: ${field} = ${rule.matchValue}`;
}
