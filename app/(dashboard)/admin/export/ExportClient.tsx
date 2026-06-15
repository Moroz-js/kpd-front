"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-custom/PageHeader";

const EXPORTED_SHEETS = [
  "Ответственные",
  "Банковские счета",
  "Виды работ",
  "Клиенты",
  "Проекты",
  "Исполнители",
  "Заказы",
  "Начисления",
  "Выставленные работы и прочие траты",
  "Выплаты",
  "План расходов (полный)",
];

export function ExportClient() {
  const [loading, setLoading] = React.useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/export-excel");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Не удалось сформировать файл");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = match
        ? decodeURIComponent(match[1])
        : `Смета_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Файл сформирован");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Экспорт в Excel" />

      <div className="max-w-2xl space-y-4 rounded-lg border bg-white p-6">
        <p className="text-sm text-neutral-600">
          Выгрузка актуальных данных в формат исходной сметы. Заполняются листы базы данных
          актуальными значениями из системы, остальные листы со сводками и формулами остаются
          без изменений.
        </p>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Что выгружается
          </p>
          <ul className="grid grid-cols-1 gap-1 text-sm text-neutral-700 sm:grid-cols-2">
            {EXPORTED_SHEETS.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-neutral-400">
          Допустимы небольшие потери: один счёт из мультиселекта, отсутствие технических колонок
          и пустые номера счетов.
        </p>

        <Button onClick={handleDownload} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Формируется…
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" /> Скачать Excel
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
