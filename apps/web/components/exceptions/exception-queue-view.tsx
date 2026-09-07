"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Download, Keyboard, Check, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import { StatusChip } from "@/components/ui/status-chip";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { ReceiptViewer } from "@/components/exceptions/receipt-viewer";
import { type ExceptionReviewItem, SEED_EXCEPTIONS, formatPeso } from "@/lib/data";

interface ExceptionQueueViewProps {
  activityId: string;
  initialExceptions?: ExceptionReviewItem[];
}

export function ExceptionQueueView({
  activityId,
  initialExceptions = SEED_EXCEPTIONS,
}: ExceptionQueueViewProps) {
  const { locale } = useTranslation();

  const [exceptions, setExceptions] = useState<ExceptionReviewItem[]>(initialExceptions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [correctionText, setCorrectionText] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [isWaiveModalOpen, setIsWaiveModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const correctionInputRef = useRef<HTMLInputElement>(null);
  const waiverInputRef = useRef<HTMLInputElement>(null);
  const currentItem = exceptions[selectedIndex] || exceptions[0];

  const resolvedCount = exceptions.filter((e) => e.status !== "open").length;
  const totalCount = exceptions.length;
  const allResolved = resolvedCount === totalCount;
  const progressPercent = Math.round((resolvedCount / totalCount) * 100);

  // Trigger brief functional confirmation
  const triggerFeedback = useCallback((msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 1200);
  }, []);

  // Accept Action (Key 'a')
  const handleAccept = useCallback(() => {
    if (!currentItem || currentItem.status !== "open") return;

    setExceptions((prev) =>
      prev.map((e, idx) =>
        idx === selectedIndex
          ? {
              ...e,
              status: "resolved" as const,
              resolution_note: "Accepted extracted values",
            }
          : e,
      ),
    );

    triggerFeedback("Accepted (Resolved)");

    // Auto-advance to next open exception
    setTimeout(() => {
      setSelectedIndex((cur) => (cur + 1 < totalCount ? cur + 1 : cur));
    }, 250);
  }, [currentItem, selectedIndex, totalCount, triggerFeedback]);

  // Correct Action (Key 'c')
  const handleCorrect = useCallback(
    (valueToApply?: string) => {
      if (!currentItem) return;
      const text = valueToApply !== undefined ? valueToApply : correctionText;
      if (!text.trim()) {
        correctionInputRef.current?.focus();
        return;
      }

      setExceptions((prev) =>
        prev.map((e, idx) =>
          idx === selectedIndex
            ? {
                ...e,
                status: "resolved" as const,
                resolved_value: text.trim(),
                resolution_note: `Corrected to: ${text.trim()}`,
              }
            : e,
        ),
      );

      setCorrectionText("");
      triggerFeedback("Correction Applied");

      // Auto-advance
      setTimeout(() => {
        setSelectedIndex((cur) => (cur + 1 < totalCount ? cur + 1 : cur));
      }, 250);
    },
    [currentItem, correctionText, selectedIndex, totalCount, triggerFeedback],
  );

  // Waive Action (Key 'w')
  const handleOpenWaive = useCallback(() => {
    if (!currentItem || currentItem.status !== "open") return;
    setIsWaiveModalOpen(true);
    setTimeout(() => waiverInputRef.current?.focus(), 50);
  }, [currentItem]);

  const handleSubmitWaive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!waiverReason.trim()) return;

    setExceptions((prev) =>
      prev.map((item, idx) =>
        idx === selectedIndex
          ? {
              ...item,
              status: "waived" as const,
              resolution_note: `Waived: ${waiverReason.trim()}`,
            }
          : item,
      ),
    );

    setWaiverReason("");
    setIsWaiveModalOpen(false);
    triggerFeedback("Waived with Reason");

    setTimeout(() => {
      setSelectedIndex((cur) => (cur + 1 < totalCount ? cur + 1 : cur));
    }, 250);
  };

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in inputs or textarea
      const target = e.target as HTMLElement;
      const isInputActive = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        if (isWaiveModalOpen) {
          setIsWaiveModalOpen(false);
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (isInputActive) {
        if (e.key === "Enter" && target === correctionInputRef.current) {
          e.preventDefault();
          handleCorrect();
          target.blur();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
          e.preventDefault();
          setSelectedIndex((cur) => (cur + 1 < totalCount ? cur + 1 : cur));
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          setSelectedIndex((cur) => (cur - 1 >= 0 ? cur - 1 : 0));
          break;
        case "a":
          e.preventDefault();
          handleAccept();
          break;
        case "c":
          e.preventDefault();
          correctionInputRef.current?.focus();
          break;
        case "w":
          e.preventDefault();
          handleOpenWaive();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalCount, isWaiveModalOpen, handleAccept, handleCorrect, handleOpenWaive]);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert(
        "Evidence Packet ZIP generated with 3 PDFs, 12 receipts, and cryptographic manifest.json!",
      );
    }, 800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-brand-surface text-foreground font-sans">
      {/* Top Review Bar & Progress */}
      <div className="px-5 py-3 border-b border-border bg-card flex flex-wrap items-center justify-between gap-4 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/activities/${activityId}`}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden rounded px-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Exception Review Queue
            </span>
            <span className="text-[11px] font-mono text-muted-foreground ml-2">
              ({resolvedCount} of {totalCount} resolved)
            </span>
          </div>
        </div>

        {/* Progress bar + Keyboard Shortcuts Badge */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-32 sm:w-44 h-2 bg-muted rounded-full border border-border/80 overflow-hidden">
              <div
                className={
                  allResolved
                    ? "h-full bg-status-success-fill transition-all duration-300"
                    : "h-full bg-brand-accent transition-all duration-300"
                }
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold tabular-nums">{progressPercent}%</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded border border-border/80">
            <Keyboard className="w-3.5 h-3.5 text-brand-accent" />
            <span>
              <kbd className="font-bold text-foreground">j</kbd>/
              <kbd className="font-bold text-foreground">k</kbd> nav •{" "}
              <kbd className="font-bold text-foreground">a</kbd> accept •{" "}
              <kbd className="font-bold text-foreground">c</kbd> correct •{" "}
              <kbd className="font-bold text-foreground">w</kbd> waive
            </span>
          </div>
        </div>
      </div>

      {/* Completion Banner if all resolved */}
      {allResolved && (
        <div className="px-6 py-3 bg-status-success-bg border-b border-status-success-border text-status-success-text flex items-center justify-between gap-4 animate-in fade-in-50 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-status-success-fill shrink-0" />
            <span>
              All 12 exceptions resolved! Activity is clear of blocking issues. Ready to generate
              liquidation packet.
            </span>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md shadow-xs hover:bg-brand-primary-hover flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? "Packaging..." : "Export Evidence Packet (.ZIP)"}</span>
          </button>
        </div>
      )}

      {/* Action Flash Confirmation Toast */}
      {actionFeedback && (
        <div className="absolute top-16 right-6 z-50 px-3.5 py-1.5 rounded bg-brand-primary text-brand-primary-fg text-xs font-bold shadow-lg border border-border flex items-center gap-2 animate-in fade-in-50">
          <Check className="w-3.5 h-3.5 text-status-success-fill" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* 3-Pane Review Workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Pane: Exceptions List (3 cols) */}
        <div className="md:col-span-3 border-r border-border bg-card overflow-y-auto p-3 space-y-2">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
            <span>Exceptions ({totalCount})</span>
            <span>Status</span>
          </div>

          <div className="space-y-1.5" role="listbox" aria-label="Exceptions list">
            {exceptions.map((exc, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={exc.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden ${
                    isSelected
                      ? "bg-muted/80 border-brand-accent shadow-xs"
                      : "bg-card border-border/70 hover:bg-muted/40"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground truncate">
                      {exc.extracted_values.merchant_name || "Unknown Merchant"}
                    </span>
                    <StatusChip status={exc.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono">
                      {exc.extracted_values.total_amount !== undefined
                        ? formatPeso(exc.extracted_values.total_amount)
                        : "—"}
                    </span>
                    <span
                      className={
                        exc.severity === "blocking"
                          ? "px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-status-danger-bg text-status-danger-text border border-status-danger-border"
                          : "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-status-warning-bg text-status-warning-text border border-status-warning-border"
                      }
                    >
                      {exc.severity}
                    </span>
                  </div>

                  {exc.resolution_note && (
                    <p className="text-[10px] text-muted-foreground truncate border-t border-border/40 pt-1">
                      {exc.resolution_note}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Pane: Receipt Viewer with Zoom/Pan (5 cols) */}
        <div className="md:col-span-5 bg-muted/20 p-4 border-r border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2 px-1">
            <span>VOUCHER IMAGE INSPECTOR</span>
            <span className="font-mono text-[11px]">{currentItem.receipt_id.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-h-[350px]">
            <ReceiptViewer exception={currentItem} />
          </div>
        </div>

        {/* Right Pane: Review Decision & Single Question (4 cols) */}
        <div className="md:col-span-4 bg-card p-6 overflow-y-auto flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Question Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-brand-primary text-brand-primary-fg font-mono">
                  Issue #{selectedIndex + 1}
                </span>
                <StatusChip status={currentItem.status} size="sm" />
              </div>
              <h2 className="text-base font-bold text-foreground leading-snug">
                {locale === "fil" ? currentItem.question_text_fil : currentItem.question_text}
              </h2>
            </div>

            {/* Confidence Score & Extracted Value */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Extracted Values & Confidence
              </span>
              <ConfidenceBar score={currentItem.confidence} />
            </div>

            {/* Suggested Values Quick Selection */}
            {currentItem.suggested_values && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Suggested Value Options
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currentItem.suggested_values).map(([label, val]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleCorrect(String(val))}
                      className="px-3 py-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground text-left focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                    >
                      <span className="text-[10px] text-muted-foreground block">{label}:</span>
                      <span className="font-mono font-bold">{String(val)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Correction Field */}
            <div className="space-y-2">
              <label
                htmlFor="correction-input"
                className="block text-xs font-bold uppercase tracking-wider text-foreground"
              >
                Manual Correction Field{" "}
                <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
                  c
                </kbd>
              </label>
              <div className="flex gap-2">
                <input
                  id="correction-input"
                  ref={correctionInputRef}
                  type="text"
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Enter corrected value..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-md border border-input bg-background text-foreground font-mono focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleCorrect()}
                  className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold rounded-md focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Action Bar (a, c, w) */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              {/* Accept */}
              <button
                type="button"
                onClick={handleAccept}
                disabled={currentItem.status !== "open"}
                className="py-2.5 px-3 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md shadow-xs hover:bg-brand-primary-hover transition-colors flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              >
                <div className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-status-success-fill" />
                  <span>Accept</span>
                </div>
                <span className="text-[10px] opacity-70 font-mono">key (a)</span>
              </button>

              {/* Correct */}
              <button
                type="button"
                onClick={() => correctionInputRef.current?.focus()}
                className="py-2.5 px-3 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-bold rounded-md transition-colors flex flex-col items-center justify-center gap-0.5 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              >
                <span>Correct</span>
                <span className="text-[10px] text-muted-foreground font-mono">key (c)</span>
              </button>

              {/* Waive */}
              <button
                type="button"
                onClick={handleOpenWaive}
                disabled={currentItem.status !== "open"}
                className="py-2.5 px-3 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-bold rounded-md transition-colors flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              >
                <span>Waive</span>
                <span className="text-[10px] text-muted-foreground font-mono">key (w)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Waiver Reason Modal */}
      {isWaiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-foreground font-bold text-base">
                <AlertTriangle className="w-4 h-4 text-brand-accent" />
                <span>Sign Audit Waiver</span>
              </div>
              <button
                type="button"
                onClick={() => setIsWaiveModalOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              A written justification is mandatory by COA and university audit rules. This waiver
              will be recorded in the immutable audit log.
            </p>

            <form onSubmit={handleSubmitWaive} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Waiver Reason / Justification *
                </label>
                <input
                  ref={waiverInputRef}
                  type="text"
                  required
                  placeholder="e.g. Authorized by Faculty Adviser due to urgent summit logistics"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWaiveModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!waiverReason.trim()}
                  className="px-4 py-1.5 bg-brand-accent text-brand-accent-fg text-xs font-bold rounded-md shadow-xs hover:bg-brand-accent-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-hidden"
                >
                  Confirm Waiver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
