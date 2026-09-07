"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Calendar, Coins, Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateActivityModal } from "@/components/activities/create-activity-modal";
import { formatPeso, SEED_ACTIVITIES, type ActivitySummary } from "@/lib/data";

export function ActivityListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-2/3">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
          <div className="h-8 bg-muted rounded pt-2" />
        </div>
      ))}
    </div>
  );
}

export function ActivityList({
  initialActivities = SEED_ACTIVITIES,
  isLoading = false,
}: {
  initialActivities?: ActivitySummary[];
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivitySummary[]>(initialActivities);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreated = (newAct: ActivitySummary) => {
    setActivities([newAct, ...activities]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t.activities.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.activities.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-brand-accent text-brand-accent-fg font-bold text-xs rounded-md shadow-sm hover:bg-brand-accent-hover transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t.activities.newActivityBtn}
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && <ActivityListSkeleton />}

      {/* Empty State */}
      {!isLoading && activities.length === 0 && (
        <EmptyState
          title={t.activities.emptyTitle}
          description={t.activities.emptyDesc}
          action={
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md flex items-center gap-1.5 shadow-sm hover:bg-brand-primary-hover"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.activities.createFirstBtn}
            </button>
          }
        />
      )}

      {/* Populated Activities Grid */}
      {!isLoading && activities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activities.map((act) => {
            const isOver = act.total_spend > act.cash_advance_amount;

            return (
              <Card
                key={act.id}
                accent={isOver ? "danger" : "primary"}
                className="hover:border-border/80 transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold">{act.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1 font-mono text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {act.start_date} – {act.end_date}
                      </CardDescription>
                    </div>
                    <StatusChip status={act.status} size="sm" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-2">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {t.activities.cashAdvance}
                      </span>
                      <span className="font-mono font-bold text-sm text-foreground block mt-0.5">
                        {formatPeso(act.cash_advance_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {t.activities.totalSpend}
                      </span>
                      <span
                        className={
                          isOver
                            ? "font-mono font-bold text-sm text-status-danger-text block mt-0.5"
                            : "font-mono font-bold text-sm text-foreground block mt-0.5"
                        }
                      >
                        {formatPeso(act.total_spend)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      {t.activities.budgetLinesCount.replace(
                        "{count}",
                        act.budget_lines_count.toString(),
                      )}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 justify-end">
                  <Link
                    href={`/activities/${act.id}`}
                    className="text-xs font-bold text-brand-primary flex items-center gap-1.5 hover:underline"
                  >
                    <span>{t.activities.viewReconciliation}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      <CreateActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
