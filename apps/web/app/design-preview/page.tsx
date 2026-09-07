import React from "react";
import { StatusChip, type KatibayStatus } from "@/components/ui/status-chip";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt, Plus, ArrowRight, ShieldCheck, FileSpreadsheet } from "lucide-react";

export default function DesignPreviewPage() {
  const receiptStatuses: KatibayStatus[] = [
    "queued",
    "extracted",
    "verified",
    "exception",
    "approved",
    "rejected",
  ];

  const activityStatuses: KatibayStatus[] = ["draft", "collecting", "review", "closed"];

  const exceptionStatuses: KatibayStatus[] = ["open", "resolved", "waived"];

  const budgetStatuses: KatibayStatus[] = ["on_track", "over_budget", "balanced"];

  return (
    <div className="min-h-screen bg-brand-surface p-6 sm:p-10 font-sans text-foreground">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                Visual Token Architecture
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
                Katibay Design System Preview
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Foundational UI primitives, semantic status chips, confidence meters, and card
                surfaces.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status="verified" label="System Ready" size="md" />
            </div>
          </div>
        </header>

        {/* Section 1: Color Token Swatches */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            1. Brand & Semantic Color Scales
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {/* Brand Primary */}
            <div className="p-4 rounded-lg border border-border bg-card shadow-sm space-y-2">
              <div className="h-12 w-full rounded bg-brand-primary border border-border/20 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-primary-fg font-mono">#0F172A</span>
              </div>
              <p className="text-xs font-bold text-foreground">brand-primary</p>
              <p className="text-[11px] text-muted-foreground">Midnight Ink</p>
            </div>

            {/* Brand Accent */}
            <div className="p-4 rounded-lg border border-border bg-card shadow-sm space-y-2">
              <div className="h-12 w-full rounded bg-brand-accent border border-border/20 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-accent-fg font-mono">#C2410C</span>
              </div>
              <p className="text-xs font-bold text-foreground">brand-accent</p>
              <p className="text-[11px] text-muted-foreground">Terracotta Seal</p>
            </div>

            {/* Success */}
            <div className="p-4 rounded-lg border border-status-success-border bg-status-success-bg shadow-sm space-y-2">
              <div className="h-12 w-full rounded bg-status-success-fill flex items-center justify-center">
                <span className="text-xs font-bold text-status-success-fg font-mono">#059669</span>
              </div>
              <p className="text-xs font-bold text-status-success-text">status-success</p>
              <p className="text-[11px] text-status-success-text/80">Approved / On Track</p>
            </div>

            {/* Warning */}
            <div className="p-4 rounded-lg border border-status-warning-border bg-status-warning-bg shadow-sm space-y-2">
              <div className="h-12 w-full rounded bg-status-warning-fill flex items-center justify-center">
                <span className="text-xs font-bold text-status-warning-fg font-mono">#D97706</span>
              </div>
              <p className="text-xs font-bold text-status-warning-text">status-warning</p>
              <p className="text-[11px] text-status-warning-text/80">Soft-flag / Collecting</p>
            </div>

            {/* Danger */}
            <div className="p-4 rounded-lg border border-status-danger-border bg-status-danger-bg shadow-sm space-y-2">
              <div className="h-12 w-full rounded bg-status-danger-fill flex items-center justify-center">
                <span className="text-xs font-bold text-status-danger-fg font-mono">#DC2626</span>
              </div>
              <p className="text-xs font-bold text-status-danger-text">status-danger</p>
              <p className="text-[11px] text-status-danger-text/80">Exception / Over Budget</p>
            </div>
          </div>
        </section>

        {/* Section 2: Status Chips */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              2. StatusChip Primitive (Never Color Alone)
            </h2>
            <span className="text-xs text-muted-foreground">All Enum States</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipt Lifecycle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Lifecycle States</CardTitle>
                <CardDescription>
                  Tracks ingestion, OCR extraction, verification, exception, and approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                {receiptStatuses.map((st) => (
                  <StatusChip key={st} status={st} />
                ))}
              </CardContent>
            </Card>

            {/* Activity Lifecycle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Liquidation States</CardTitle>
                <CardDescription>
                  Orchestrates draft setup, receipt collection, audit review, and final closure.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                {activityStatuses.map((st) => (
                  <StatusChip key={st} status={st} />
                ))}
              </CardContent>
            </Card>

            {/* Exception States */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exception Resolution States</CardTitle>
                <CardDescription>
                  Manages open blocking issues, user corrections, and signed waivers.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                {exceptionStatuses.map((st) => (
                  <StatusChip key={st} status={st} />
                ))}
              </CardContent>
            </Card>

            {/* Budget & Size Variations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Budget Evaluations & Chip Sizes</CardTitle>
                <CardDescription>
                  Categorical variance evaluations alongside small, medium, and large chips.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2.5">
                  {budgetStatuses.map((st) => (
                    <StatusChip key={st} status={st} />
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <StatusChip status="approved" size="sm" label="Small (sm)" />
                  <StatusChip status="approved" size="md" label="Medium (md)" />
                  <StatusChip status="approved" size="lg" label="Large (lg)" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3: Confidence Bar */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              3. ConfidenceBar Primitive (3.3 Tiers)
            </h2>
            <span className="text-xs text-muted-foreground">Numeric + Meter + Label</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier 1: High Confidence */}
            <Card accent="success">
              <CardHeader>
                <CardTitle className="text-base">Tier 1: High Confidence (≥ 0.92)</CardTitle>
                <CardDescription>
                  Eligible for auto-approval when all mathematical checks match.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ConfidenceBar score={0.96} />
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                    Compact variant:
                  </p>
                  <ConfidenceBar score={0.94} compact />
                </div>
              </CardContent>
            </Card>

            {/* Tier 2: Review Recommended */}
            <Card accent="warning">
              <CardHeader>
                <CardTitle className="text-base">Tier 2: Soft-Flagged (0.70 – 0.92)</CardTitle>
                <CardDescription>
                  Requires treasurer visual verification before posting to ledger.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ConfidenceBar score={0.82} />
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                    Compact variant:
                  </p>
                  <ConfidenceBar score={0.75} compact />
                </div>
              </CardContent>
            </Card>

            {/* Tier 3: Low Confidence / Exception */}
            <Card accent="danger">
              <CardHeader>
                <CardTitle className="text-base">Tier 3: Exception (&lt; 0.70)</CardTitle>
                <CardDescription>
                  Triggers blocking exception. Resolution or waiver is mandatory.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ConfidenceBar score={0.54} />
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                    Compact variant:
                  </p>
                  <ConfidenceBar score={0.45} compact />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 4: Card Component Surfaces */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            4. Card Surface Variants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card accent="primary">
              <CardHeader>
                <CardTitle className="text-base">Primary Accent Card</CardTitle>
                <CardDescription>Official Activity Summary Overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash Advance:</span>
                    <span className="font-mono font-bold">₱30,000.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Spend:</span>
                    <span className="font-mono font-bold">₱25,000.00</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <StatusChip status="on_track" size="sm" />
                <button className="text-xs font-semibold text-brand-primary flex items-center gap-1 hover:underline">
                  View Details <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </CardFooter>
            </Card>

            <Card accent="accent">
              <CardHeader>
                <CardTitle className="text-base">Terracotta Brand Action Card</CardTitle>
                <CardDescription>Evidence Packet Ready for Export</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  3 official PDFs rendered, 12 receipts packaged with SHA-256 manifest.
                </p>
              </CardContent>
              <CardFooter className="justify-end">
                <button className="px-3 py-1.5 bg-brand-accent text-brand-accent-fg text-xs font-bold rounded-md hover:bg-brand-accent-hover transition-colors">
                  Download Packet (.ZIP)
                </button>
              </CardFooter>
            </Card>

            <Card accent="danger">
              <CardHeader>
                <CardTitle className="text-base">Blocking Alert Card</CardTitle>
                <CardDescription>Unresolved Exception</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-status-danger-text font-medium">
                  Arithmetic mismatch: Line items sum to ₱1,250.00 but receipt total states
                  ₱1,350.00.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <StatusChip status="open" size="sm" />
                <button className="text-xs font-bold text-status-danger-text hover:underline">
                  Resolve Exception
                </button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Section 5: EmptyState Primitive */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            5. EmptyState Primitive
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmptyState
              icon={Receipt}
              title="No Receipts Uploaded"
              description="Upload your official receipts or invoices to start automated extraction and arithmetic verification."
              action={
                <button className="px-4 py-2 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md flex items-center gap-1.5 shadow-sm hover:bg-brand-primary-hover transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Upload Receipts
                </button>
              }
            />

            <EmptyState
              icon={ShieldCheck}
              title="All Exceptions Resolved"
              description="There are no blocking or warning exceptions for this activity. All disbursements are verified."
              action={
                <button className="px-4 py-2 bg-status-success-fill text-status-success-fg text-xs font-bold rounded-md flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Generate Liquidation Packet
                </button>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
