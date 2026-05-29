"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PeriodToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const groupBy = searchParams.get("groupBy") ?? "month";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      {groupBy !== "year" && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setParam("year", String(currentYear - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-12 text-center">{currentYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setParam("year", String(currentYear + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-1 border rounded-md p-0.5 bg-neutral-100">
        {[
          { value: "month", label: "Месяц" },
          { value: "quarter", label: "Квартал" },
          { value: "year", label: "Год" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setParam("groupBy", opt.value)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              groupBy === opt.value
                ? "bg-white shadow-sm font-medium text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
