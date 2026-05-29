import { StatusBadge } from "./StatusBadge";
import { WORK_STATUSES } from "@/lib/statuses";

type WorkStatusBadgeProps = {
  status: string;
};

export function WorkStatusBadge({ status }: WorkStatusBadgeProps) {
  return <StatusBadge dict={WORK_STATUSES} value={status} />;
}
