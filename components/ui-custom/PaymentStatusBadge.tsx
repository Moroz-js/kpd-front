import { StatusBadge } from "./StatusBadge";
import { PAYMENT_STATUSES } from "@/lib/statuses";

type PaymentStatusBadgeProps = {
  status: string;
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return <StatusBadge dict={PAYMENT_STATUSES} value={status} />;
}
