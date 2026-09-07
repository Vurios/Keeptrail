import { notFound } from "next/navigation";
import { ReconciliationDashboard } from "@/components/reconciliation/reconciliation-dashboard";
import { SEED_RECONCILIATION, SEED_ACTIVITIES, type ReconciliationDetails } from "@/lib/data";

export default async function ActivityReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch or resolve reconciliation details from seed store
  const data: ReconciliationDetails | undefined =
    SEED_RECONCILIATION[id] ||
    (SEED_ACTIVITIES.find((a) => a.id === id)
      ? {
          activity: SEED_ACTIVITIES.find((a) => a.id === id)!,
          cash_advance_amount: SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount,
          total_approved: SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount,
          total_actual_spend: SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend,
          net_balance:
            SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount -
            SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend,
          is_over_budget:
            SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend >
            SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount,
          overall_utilization_pct: Math.round(
            (SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend /
              SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount) *
              100,
          ),
          categories: [
            {
              category: "General Operating Expenses",
              approved_amount: SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount,
              actual_amount: SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend,
              variance:
                SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount -
                SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend,
              is_over_budget:
                SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend >
                SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount,
              utilization_pct: Math.round(
                (SEED_ACTIVITIES.find((a) => a.id === id)!.total_spend /
                  SEED_ACTIVITIES.find((a) => a.id === id)!.cash_advance_amount) *
                  100,
              ),
            },
          ],
          receipts: [],
        }
      : undefined);

  if (!data) {
    notFound();
  }

  return <ReconciliationDashboard initialData={data} />;
}
