import { Card, CardContent } from "@/components/ui/card";

type SummaryCard = {
  label: string;
  value: string | number;
  sub?: string;
};

type SummaryCardsProps = {
  cards: SummaryCard[];
};

export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-neutral-500 mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-neutral-900">{card.value}</p>
            {card.sub && <p className="text-xs text-neutral-400 mt-1">{card.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
