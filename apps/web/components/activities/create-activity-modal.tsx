"use client";

import React, { useState } from "react";
import { Plus, Trash2, X, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import { formatPeso, type ActivitySummary } from "@/lib/data";

interface BudgetLineInput {
  id: string;
  category: string;
  amount: string;
}

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (activity: ActivitySummary) => void;
}

export function CreateActivityModal({ isOpen, onClose, onCreated }: CreateActivityModalProps) {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cashAdvance, setCashAdvance] = useState("");
  const [budgetLines, setBudgetLines] = useState<BudgetLineInput[]>([
    { id: "1", category: "Food & Catering", amount: "15000" },
    { id: "2", category: "Transportation", amount: "8000" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddBudgetLine = () => {
    setBudgetLines([...budgetLines, { id: Date.now().toString(), category: "", amount: "" }]);
  };

  const handleRemoveBudgetLine = (id: string) => {
    if (budgetLines.length > 1) {
      setBudgetLines(budgetLines.filter((b) => b.id !== id));
    }
  };

  const handleUpdateBudgetLine = (id: string, field: "category" | "amount", value: string) => {
    setBudgetLines(budgetLines.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const totalAllocatedCentavos = budgetLines.reduce((sum, b) => {
    const val = parseFloat(b.amount) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter an activity title.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    const cashAdvanceNum = parseFloat(cashAdvance) || 0;
    const cashAdvanceCentavos = Math.round(cashAdvanceNum * 100);

    setIsSubmitting(true);

    setTimeout(() => {
      const newActivity: ActivitySummary = {
        id: `act-${Date.now()}`,
        workspace_id: "ws-guild-001",
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        cash_advance_amount: cashAdvanceCentavos,
        status: "collecting",
        budget_lines_count: budgetLines.filter((b) => b.category.trim()).length,
        total_spend: 0,
      };

      onCreated(newActivity);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{t.createActivity.modalTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t.createActivity.modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Activity Title */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              {t.createActivity.titleLabel} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.createActivity.titlePlaceholder}
              className="w-full px-3.5 py-2 text-sm rounded-md border border-input bg-background focus:outline-hidden focus:ring-2 focus:ring-brand-accent font-medium text-foreground"
            />
          </div>

          {/* Date Window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                {t.createActivity.startDateLabel} *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-md border border-input bg-background focus:outline-hidden focus:ring-2 focus:ring-brand-accent font-mono text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                {t.createActivity.endDateLabel} *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-md border border-input bg-background focus:outline-hidden focus:ring-2 focus:ring-brand-accent font-mono text-foreground"
              />
            </div>
          </div>

          {/* Cash Advance */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              {t.createActivity.cashAdvanceLabel} *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-bold text-muted-foreground font-mono">
                ₱
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={cashAdvance}
                onChange={(e) => setCashAdvance(e.target.value)}
                placeholder="30,000.00"
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-md border border-input bg-background focus:outline-hidden focus:ring-2 focus:ring-brand-accent font-mono font-bold text-foreground"
              />
            </div>
          </div>

          {/* Dynamic Budget Categories */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t.createActivity.budgetLinesTitle}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {t.createActivity.budgetLinesSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBudgetLine}
                className="px-2.5 py-1 text-xs font-bold rounded-md bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1 border border-border"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.createActivity.addCategoryBtn}
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {budgetLines.map((line, idx) => (
                <div key={line.id} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder={`Category ${idx + 1}`}
                    value={line.category}
                    onChange={(e) => handleUpdateBudgetLine(line.id, "category", e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-md border border-input bg-background font-medium"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-muted-foreground font-mono">
                      ₱
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(e) => handleUpdateBudgetLine(line.id, "amount", e.target.value)}
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs rounded-md border border-input bg-background font-mono font-bold text-right"
                    />
                  </div>
                  {budgetLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBudgetLine(line.id)}
                      className="p-1.5 text-muted-foreground hover:text-status-danger-text rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total Budget Summary Banner */}
            <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t.createActivity.totalAllocated}:
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                {formatPeso(totalAllocatedCentavos)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-md"
            >
              {t.createActivity.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-brand-primary text-brand-primary-fg rounded-md shadow-sm hover:bg-brand-primary-hover disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? t.createActivity.creatingBtn : t.createActivity.submitBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
