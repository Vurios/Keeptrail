"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Plus, ArrowRight, Sparkles, Search, Calendar } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PromoteReceiptModal } from "@/components/passports/promote-receipt-modal";
import {
  type PassportItem,
  SEED_PASSPORTS,
  computeWarrantyCountdown,
  formatPeso,
} from "@/lib/data";

export function PassportList({
  initialPassports = SEED_PASSPORTS,
}: {
  initialPassports?: PassportItem[];
}) {
  const [passports, setPassports] = useState<PassportItem[]>(initialPassports);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expiring" | "expired">(
    "all",
  );
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);

  const handlePromoted = (newPassport: PassportItem) => {
    setPassports([newPassport, ...passports]);
  };

  const filteredPassports = passports.filter((p) => {
    const countdown = computeWarrantyCountdown(p.warranty_expires_at);
    const matchesSearch =
      p.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serial_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === "all") return true;
    return countdown.status === filterStatus;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 sm:p-8">
      {/* Hero Header — "Reassuring, a little proud" register */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-wider border border-brand-primary/20">
            <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
            <span>Digital Asset Registry & Warranty Passports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Equipment & Asset Passports
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Every major purchase sealed into an authentic record of ownership. Track real-time
            warranty coverage countdowns and generate authoritative claim packets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPromoteModalOpen(true)}
          className="px-4 py-2.5 bg-brand-primary text-brand-primary-fg font-bold text-xs rounded-lg shadow-sm hover:bg-brand-primary-hover transition-colors flex items-center gap-2 self-start md:self-auto focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
        >
          <Plus className="w-4 h-4" />
          <span>Register Purchase Passport</span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by asset, brand, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-input bg-card text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
          {(["all", "active", "expiring", "expired"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors capitalize ${
                filterStatus === st
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Passports Grid */}
      {filteredPassports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Passports Match Criteria"
          description="No registered assets match your current search and filter settings. Register a purchase receipt to start tracking warranty coverage."
          action={
            <button
              type="button"
              onClick={() => setIsPromoteModalOpen(true)}
              className="px-4 py-2 bg-brand-primary text-brand-primary-fg text-xs font-bold rounded-md flex items-center gap-1.5 shadow-sm hover:bg-brand-primary-hover"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Asset</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPassports.map((item) => {
            const countdown = computeWarrantyCountdown(item.warranty_expires_at);

            return (
              <div
                key={item.id}
                className="group relative rounded-xl border border-border bg-card hover:border-brand-accent/60 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden"
              >
                {/* Top Accent Stripe */}
                <div
                  className={
                    countdown.status === "active"
                      ? "h-1.5 w-full bg-status-success-fill"
                      : countdown.status === "expiring"
                        ? "h-1.5 w-full bg-status-warning-fill"
                        : "h-1.5 w-full bg-status-neutral-border"
                  }
                />

                <div className="p-5 space-y-4 flex-1">
                  {/* Item Header & Status Chip */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-accent font-mono">
                        {item.brand}
                      </span>
                      <StatusChip
                        status={countdown.statusChipStatus}
                        label={countdown.chipCustomLabel}
                        size="sm"
                      />
                    </div>
                    <h2 className="text-base font-bold text-foreground group-hover:text-brand-primary transition-colors line-clamp-2">
                      {item.item_name}
                    </h2>
                  </div>

                  {/* Serial & Purchase Meta */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-muted-foreground">S/N:</span>
                      <span className="font-bold text-foreground">{item.serial_number}</span>
                    </div>
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-muted-foreground">Purchased:</span>
                      <span className="text-foreground">{item.purchase_date}</span>
                    </div>
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-bold text-foreground">
                        {formatPeso(item.total_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Coverage Countdown Banner — Semantic Token Driven */}
                  <div
                    className={
                      countdown.tier === "active"
                        ? "p-2.5 rounded-lg border border-status-success-border bg-status-success-bg text-status-success-text text-xs font-semibold flex items-center gap-2"
                        : countdown.tier === "critical_7d"
                          ? "p-2.5 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text text-xs font-semibold flex items-center gap-2"
                          : countdown.tier === "expired"
                            ? "p-2.5 rounded-lg border border-status-neutral-border bg-status-neutral-bg text-status-neutral-text text-xs font-semibold flex items-center gap-2"
                            : "p-2.5 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning-text text-xs font-semibold flex items-center gap-2"
                    }
                  >
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="truncate">{countdown.label}</span>
                  </div>
                </div>

                {/* Card Footer Link */}
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Expires: {item.warranty_expires_at}
                  </span>
                  <Link
                    href={`/passports/${item.id}`}
                    className="font-bold text-brand-primary hover:text-brand-primary-hover flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden rounded"
                  >
                    <span>View Record</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Promote Modal */}
      <PromoteReceiptModal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        onPromoted={handlePromoted}
      />
    </div>
  );
}
