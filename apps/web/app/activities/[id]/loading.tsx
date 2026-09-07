import { ReconciliationDashboardSkeleton } from "@/components/reconciliation/reconciliation-dashboard";

export default function Loading() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <ReconciliationDashboardSkeleton />
    </div>
  );
}
