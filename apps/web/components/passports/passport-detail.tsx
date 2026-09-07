"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Calendar,
  FileText,
  AlertTriangle,
  Download,
  Plus,
  Receipt,
  FileDown,
} from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import {
  type PassportItem,
  type PassportClaimItem,
  computeWarrantyCountdown,
  formatPeso,
} from "@/lib/data";

interface PassportDetailProps {
  passport: PassportItem;
}

export function PassportDetail({ passport }: PassportDetailProps) {
  const [item, setItem] = useState<PassportItem>(passport);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [faultText, setFaultText] = useState("");
  const [isFiling, setIsFiling] = useState(false);
  const [downloadingClaimId, setDownloadingClaimId] = useState<string | null>(null);

  const countdown = computeWarrantyCountdown(item.warranty_expires_at);

  const handleFileClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultText.trim()) return;

    setIsFiling(true);

    setTimeout(() => {
      const newClaim: PassportClaimItem = {
        id: `claim-${Date.now()}`,
        passport_id: item.id,
        fault_description: faultText.trim(),
        opened_at: new Date().toISOString().split("T")[0],
        status: "open",
        packet_path: `claims/${item.id}/claim-${Date.now()}.pdf`,
      };

      setItem({
        ...item,
        status: "claimed",
        claims: [newClaim, ...item.claims],
      });

      setFaultText("");
      setIsFiling(false);
      setIsClaimModalOpen(false);
      alert(
        "Official Claim Packet generated successfully! You can download the signed evidence PDF below.",
      );
    }, 600);
  };

  const handleDownloadPacket = (claimId: string) => {
    setDownloadingClaimId(claimId);
    setTimeout(() => {
      setDownloadingClaimId(null);
      alert("Claim Packet PDF downloaded (verified against purchase ledger).");
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Back link */}
      <div>
        <Link
          href="/passports"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden rounded px-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Passports</span>
        </Link>
      </div>

      {/* Asset Hero Header — Warm & Reassuring */}
      <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6 relative overflow-hidden">
        {/* Accent Top Bar */}
        <div
          className={
            countdown.status === "active"
              ? "absolute top-0 inset-x-0 h-2 bg-status-success-fill"
              : countdown.status === "expiring"
                ? "absolute top-0 inset-x-0 h-2 bg-status-warning-fill"
                : "absolute top-0 inset-x-0 h-2 bg-status-neutral-border"
          }
        />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-mono">
                {item.brand}
              </span>
              <StatusChip
                status={countdown.statusChipStatus}
                label={countdown.chipCustomLabel}
                size="sm"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {item.item_name}
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              Model: {item.model} • S/N: {item.serial_number}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsClaimModalOpen(true)}
            className="px-5 py-2.5 bg-brand-accent text-brand-accent-fg font-bold text-xs rounded-lg shadow-sm hover:bg-brand-accent-hover transition-colors flex items-center gap-2 shrink-0 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-hidden"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>File Warranty Claim</span>
          </button>
        </div>

        {/* Coverage Countdown Banner */}
        <div
          className={
            countdown.tier === "active"
              ? "p-4 rounded-xl border border-status-success-border bg-status-success-bg text-status-success-text flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              : countdown.tier === "critical_7d"
                ? "p-4 rounded-xl border border-status-danger-border bg-status-danger-bg text-status-danger-text flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                : countdown.tier === "expired"
                  ? "p-4 rounded-xl border border-status-neutral-border bg-status-neutral-bg text-status-neutral-text flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  : "p-4 rounded-xl border border-status-warning-border bg-status-warning-bg text-status-warning-text flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          }
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold text-sm">{countdown.label}</p>
              <p className="text-xs opacity-85">
                Protection active from {item.purchase_date} until {item.warranty_expires_at} (
                {item.warranty_months} months total coverage)
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Grid: Purchase & Warranty Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
          {/* Purchase Details */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-brand-accent" />
              <span>Purchase & Retailer Record</span>
            </h2>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Store / Vendor:</span>
                <span className="font-semibold text-foreground">{item.merchant_name}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">OR / Invoice #:</span>
                <span className="font-semibold text-foreground">{item.or_number}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">Purchase Date:</span>
                <span className="text-foreground">{item.purchase_date}</span>
              </div>
              <div className="flex justify-between font-mono pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Purchase Price:</span>
                <span className="font-bold text-foreground text-sm">
                  {formatPeso(item.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Warranty Terms */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
              <span>Warranty Protection Scope</span>
            </h2>
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warranty Duration:</span>
                <span className="font-semibold text-foreground">{item.warranty_months} Months</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">Expiry Date:</span>
                <span className="font-semibold text-foreground">{item.warranty_expires_at}</span>
              </div>
              <div className="pt-2 border-t border-border/40 text-muted-foreground text-[11px] leading-relaxed">
                <span className="font-bold text-foreground block mb-0.5">Coverage Terms:</span>
                {item.coverage_notes}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warranty Claims History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-accent" />
            <h2 className="text-base font-bold text-foreground">
              Filed Warranty Claims ({item.claims.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsClaimModalOpen(true)}
            className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>New Claim</span>
          </button>
        </div>

        {item.claims.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2 bg-card">
            <ShieldCheck className="w-8 h-8 text-status-success-fill mx-auto" />
            <p className="text-sm font-bold text-foreground">Zero Warranty Incidents Recorded</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No defect or repair claims have been filed for this equipment. All original warranty
              terms remain in good standing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {item.claims.map((claim) => (
              <div
                key={claim.id}
                className="p-5 rounded-xl border border-border bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {claim.id.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Filed {claim.opened_at}
                    </span>
                    <StatusChip status="claimed" label="Open Claim" size="sm" />
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    {claim.fault_description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadPacket(claim.id)}
                  disabled={downloadingClaimId === claim.id}
                  className="px-4 py-2 bg-brand-primary text-brand-primary-fg font-bold text-xs rounded-lg shadow-xs hover:bg-brand-primary-hover transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    {downloadingClaimId === claim.id
                      ? "Generating..."
                      : "Download Claim Packet PDF"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claim Filing Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl p-6 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-foreground font-bold text-base">
                <AlertTriangle className="w-4 h-4 text-brand-accent" />
                <span>File Official Warranty Claim</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Generates a sealed evidence packet PDF formatted with purchase invoice, serial
                numbers, and incident timeline for vendor submission.
              </p>
            </div>

            <form onSubmit={handleFileClaim} className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1">
                <div className="font-bold text-foreground">{item.item_name}</div>
                <div className="text-muted-foreground font-mono">
                  S/N: {item.serial_number} • Coverage until {item.warranty_expires_at}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Defect Statement / Fault Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the malfunction, error code, or physical hardware defect encountered..."
                  value={faultText}
                  onChange={(e) => setFaultText(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFiling || !faultText.trim()}
                  className="px-5 py-2 bg-brand-accent text-brand-accent-fg font-bold text-xs rounded-md shadow-xs hover:bg-brand-accent-hover disabled:opacity-50 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-hidden"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isFiling ? "Generating Packet..." : "Submit Claim & Generate PDF"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
