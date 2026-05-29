/**
 * Заглушка для страниц, реализуемых в Phase 1+.
 *
 * После реализации тикета — заменяется реальной страницей.
 */

import { Construction } from "lucide-react";

export function Placeholder({ tdnb, title }: { tdnb: string; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-500">
      <Construction className="h-12 w-12 mb-4 text-neutral-300" />
      <h1 className="text-xl font-semibold text-neutral-700 mb-2">{title}</h1>
      <p className="text-sm">{tdnb} — реализуется в одной из следующих фаз.</p>
    </div>
  );
}
