"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  years: number[];
  currentYear: number;
};

export function YearSelect({ currentYear }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setYear(y: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(y));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-0.5 h-8 border border-neutral-200 rounded-md px-1 bg-white">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear(currentYear - 1)}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span className="text-sm font-semibold w-12 text-center">{currentYear}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setYear(currentYear + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
