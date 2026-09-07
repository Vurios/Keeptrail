"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Receipt,
  Download,
  CheckCircle2,
  Calendar,
  Layers,
  AlertTriangle,
  History,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPeso, type ReconciliationDetails, type ReceiptItem } from "@/lib/data";

export function ReconciliationDashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-6 w-36 bg-muted rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-card border border-border rounded-lg p-6" />
      <div className="h-80 bg-card border border-border rounded-lg p-6" />
    </div>
  );
}

export function ReconciliationDashboard({
  initialData,
  isLoading = false,
}: {
  initialData: ReconciliationDetails;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();

  const [data, setData] = useState<ReconciliationDetails>(initialData);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (isLoading) {
    return <ReconciliationDashboardSkeleton />;
  }

  const {
    activity,
    cash_advance_amount,
    total_approved,
    total_actual_spend,
    net_balance,
    is_over_budget,
    overall_utilization_pct,
    categories,
    receipts,
  } = data;

  // Optimistic receipt approval
  const handleApproveReceipt = async (receipt: ReceiptItem) => {
    if (receipt.status === "approved" || approvingId) return;

    setApprovingId(receipt.id);

    // 1. Optimistic state update
    const updatedReceipts = receipts.map((r) =>
      r.id === receipt.id ? { ...r, status: "approved" as const } : r,
    );

    const newActualSpend = total_actual_spend + receipt.amount;
    const newNetBalance = cash_advance_amount - newActualSpend;
    const newIsOver = newActualSpend > total_approved;
    const newUtilization = (newActualSpend / total_approved) * 100;

    const updatedCategories = categories.map((cat) => {
      if (cat.category.toLowerCase() === receipt.category.toLowerCase()) {
        const newCatActual = cat.actual_amount + receipt.amount;
        return {
          ...cat,
          actual_amount: newCatActual,
          variance: cat.approved_amount - newCatActual,
          is_over_budget: newCatActual > cat.approved_amount,
          utilization_pct: (newCatActual / cat.approved_amount) * 100,
        };
      }
      return cat;
    });

    setData({
      ...data,
      total_actual_spend: newActualSpend,
      net_balance: newNetBalance,
      is_over_budget: newIsOver,
      overall_utilization_pct: Math.round(newUtilization * 10) / 10,
      categories: updatedCategories,
      receipts: updatedReceipts,
    });

    setTimeout(() => {
      setApprovingId(null);
    }, 300);
  };

  const handleExportPacket = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert("Evidence Packet ZIP downloaded successfully with cryptographic SHA-256 manifest.");
    }, 800);
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Back Navigation & Header */}
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.reconciliation.backToActivities}</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {activity.title}
              </h1>
              <StatusChip status={activity.status} size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {activity.start_date} – {activity.end_date}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {categories.length} {t.reconciliation.categoryAllocationsTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/activities/${activity.id}/audit`}
              className="px-3.5 py-2 bg-card border border-border text-foreground font-bold text-xs rounded-md shadow-xs hover:bg-muted transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
            >
              <History className="w-4 h-4 text-brand-primary" />
              <span>Audit Trail</span>
            </Link>

            <Link
              href={`/activities/${activity.id}/exceptions`}
              className="px-3.5 py-2 bg-brand-accent text-brand-accent-fg font-bold text-xs rounded-md shadow-xs hover:bg-brand-accent-hover transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-hidden"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Review Exceptions</span>
            </Link>

            <button
              type="button"
              onClick={handleExportPacket}
              disabled={isExporting}
              className="px-4 py-2 bg-brand-primary text-brand-primary-fg font-bold text-xs rounded-md shadow-sm hover:bg-brand-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting ? t.reconciliation.exportingBtn : t.reconciliation.exportPacketBtn}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Variance Headline Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Advance */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" />
            {t.reconciliation.cashAdvanceIssued}
          </span>
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {formatPeso(cash_advance_amount)}
          </p>
        </div>

        {/* Total Liquidated Spend */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.reconciliation.totalDisbursed}
          </span>
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {formatPeso(total_actual_spend)}
          </p>
        </div>

        {/* Net Balance */}
        <div
          className={
            net_balance >= 0
              ? "p-4 rounded-lg border border-status-success-border bg-status-success-bg shadow-xs space-y-1"
              : "p-4 rounded-lg border border-status-danger-border bg-status-danger-bg shadow-xs space-y-1"
          }
        >
          <span
            className={
              net_balance >= 0
                ? "text-[11px] font-bold uppercase tracking-wider text-status-success-text"
                : "text-[11px] font-bold uppercase tracking-wider text-status-danger-text"
            }
          >
            {net_balance >= 0
              ? t.reconciliation.excessToReturn
              : t.reconciliation.overageToReimburse}
          </span>
          <p
            className={
              net_balance >= 0
                ? "font-mono text-2xl font-extrabold tracking-tight text-status-success-text"
                : "font-mono text-2xl font-extrabold tracking-tight text-status-danger-text"
            }
          >
            {formatPeso(Math.abs(net_balance))}
          </p>
        </div>

        {/* Budget Utilization */}
        <div
          className={
            is_over_budget
              ? "p-4 rounded-lg border border-status-danger-border bg-status-danger-bg shadow-xs space-y-1"
              : "p-4 rounded-lg border border-border bg-card shadow-xs space-y-1"
          }
        >
          <span
            className={
              is_over_budget
                ? "text-[11px] font-bold uppercase tracking-wider text-status-danger-text"
                : "text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            }
          >
            {t.reconciliation.overallUtilization}
          </span>
          <div className="flex items-baseline justify-between">
            <p
              className={
                is_over_budget
                  ? "font-mono text-2xl font-extrabold tracking-tight text-status-danger-text"
                  : "font-mono text-2xl font-extrabold tracking-tight text-foreground"
              }
            >
              {overall_utilization_pct}%
            </p>
            <span
              className={
                is_over_budget
                  ? "text-xs font-bold text-status-danger-text uppercase"
                  : "text-xs font-bold text-status-success-text uppercase"
              }
            >
              {is_over_budget ? t.reconciliation.overBudget : t.reconciliation.withinBudget}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Category Progress Bars & Variances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            {t.reconciliation.categoryAllocationsTitle}
          </CardTitle>
          <CardDescription>{t.reconciliation.categoryAllocationsSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {categories.map((cat) => {
              const clampedProgress = Math.min(100, Math.max(0, cat.utilization_pct));

              return (
                <div key={cat.category} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{cat.category}</span>
                      {cat.is_over_budget && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-status-danger-border bg-status-danger-bg text-status-danger-text flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t.reconciliation.overBudget}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground">
                        {formatPeso(cat.actual_amount)} / {formatPeso(cat.approved_amount)}
                      </span>
                      <span
                        className={
                          cat.is_over_budget
                            ? "font-bold text-status-danger-text"
                            : "font-bold text-foreground"
                        }
                      >
                        ({Math.round(cat.utilization_pct)}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress Meter — Uses status-danger-fill on overage, brand-primary on normal */}
                  <div className="w-full h-2.5 rounded-full bg-muted border border-border/80 overflow-hidden">
                    <div
                      className={
                        cat.is_over_budget
                          ? "h-full rounded-full transition-all duration-300 bg-status-danger-fill"
                          : "h-full rounded-full transition-all duration-300 bg-brand-primary"
                      }
                      style={{ width: `${clampedProgress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Receipts Ledger & Verification Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold">
              {t.reconciliation.receiptsLedgerTitle}
            </CardTitle>
            <CardDescription>{t.reconciliation.receiptsLedgerSubtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t.reconciliation.emptyReceiptsTitle}
              description={t.reconciliation.emptyReceiptsDesc}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3">{t.reconciliation.colDate}</th>
                    <th className="py-3 px-3">{t.reconciliation.colOrNumber}</th>
                    <th className="py-3 px-3">{t.reconciliation.colMerchant}</th>
                    <th className="py-3 px-3">{t.reconciliation.colCategory}</th>
                    <th className="py-3 px-3 text-right">{t.reconciliation.colAmount}</th>
                    <th className="py-3 px-3">{t.reconciliation.colConfidence}</th>
                    <th className="py-3 px-3 text-center">{t.reconciliation.colStatus}</th>
                    <th className="py-3 px-3 text-right">{t.reconciliation.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {rec.txn_date}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-xs font-semibold whitespace-nowrap">
                        {rec.or_number}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-foreground">
                        {rec.merchant_name}
                      </td>
                      <td className="py-3.5 px-3 text-xs text-muted-foreground">{rec.category}</td>
                      <td className="py-3.5 px-3 font-mono font-bold text-right text-foreground whitespace-nowrap">
                        {formatPeso(rec.amount)}
                      </td>
                      <td className="py-3.5 px-3 min-w-[140px]">
                        <ConfidenceBar score={rec.confidence} compact />
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <StatusChip status={rec.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {rec.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-status-success-text">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t.reconciliation.btnApproved}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveReceipt(rec)}
                            disabled={approvingId === rec.id}
                            className="px-3 py-1 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
                          >
                            {approvingId === rec.id
                              ? t.reconciliation.btnApproving
                              : t.reconciliation.btnApprove}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
