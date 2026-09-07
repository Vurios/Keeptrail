"use client";

import React, { useState } from "react";
import { X, ShieldCheck, AlertCircle } from "lucide-react";
import { type PassportItem } from "@/lib/data";

interface PromoteReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromoted: (passport: PassportItem) => void;
}

export function PromoteReceiptModal({ isOpen, onClose, onPromoted }: PromoteReceiptModalProps) {
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("2026-08-15");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [coverageNotes, setCoverageNotes] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [orNumber, setOrNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("15000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemName.trim()) {
      setError("Item name is required.");
      return;
    }
    const months = parseInt(warrantyMonths, 10);
    if (isNaN(months) || months <= 0) {
      setError("Warranty months must be greater than 0.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const pDate = new Date(purchaseDate);
      const expDate = new Date(pDate);
      expDate.setMonth(expDate.getMonth() + months);
      const expiresAtStr = expDate.toISOString().split("T")[0];

      const newPassport: PassportItem = {
        id: `pass-${Date.now()}`,
        workspace_id: "ws-guild-001",
        receipt_id: `rec-${Date.now()}`,
        item_name: itemName.trim(),
        brand: brand.trim() || "Generic",
        model: model.trim() || "N/A",
        serial_number: serialNumber.trim() || "S/N Pending",
        purchase_date: purchaseDate,
        warranty_months: months,
        warranty_expires_at: expiresAtStr,
        coverage_notes:
          coverageNotes.trim() ||
          "Standard manufacturer warranty covering parts and labor defects.",
        status: "active",
        merchant_name: merchantName.trim() || "Official Retailer",
        or_number: orNumber.trim() || "OR-PENDING",
        total_amount: Math.round((parseFloat(totalAmount) || 0) * 100),
        claims: [],
      };

      onPromoted(newPassport);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary text-brand-primary-fg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Register Purchase Passport</h3>
              <p className="text-xs text-muted-foreground">
                Turn a verified receipt into an asset passport with warranty countdown.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              Asset / Equipment Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sony FX3 Cinema Camera"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                placeholder="e.g. Sony, Apple, Dell"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Model Number</label>
              <input
                type="text"
                placeholder="e.g. ILME-FX3, A2992"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Serial Number (S/N)
              </label>
              <input
                type="text"
                placeholder="e.g. SN-8821099"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-mono text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-mono text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Warranty Period (Months) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-mono font-bold text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Purchase Price (₱)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-mono font-bold text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Merchant / Store Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sony Centre Megamall"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                OR / Invoice Number
              </label>
              <input
                type="text"
                placeholder="e.g. SI-889912"
                value={orNumber}
                onChange={(e) => setOrNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-mono text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              Coverage Scope & Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 1-year official distributor warranty covering parts and labor."
              value={coverageNotes}
              onChange={(e) => setCoverageNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-md border border-input bg-background font-medium text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-brand-primary text-brand-primary-fg rounded-md shadow-sm hover:bg-brand-primary-hover disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
            >
              {isSubmitting ? "Registering..." : "Create Passport"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
