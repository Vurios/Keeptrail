"use client";

import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Move, FileText } from "lucide-react";
import { type ExceptionReviewItem, formatPeso } from "@/lib/data";

interface ReceiptViewerProps {
  exception: ExceptionReviewItem;
}

export function ReceiptViewer({ exception }: ReceiptViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const handleZoomOut = () => setScale((s) => Math.max(0.75, s - 0.25));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const { extracted_values } = exception;

  return (
    <div className="relative w-full h-full min-h-[420px] bg-muted/40 border border-border rounded-lg overflow-hidden flex flex-col select-none">
      {/* Top Floating Zoom Controls Bar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 p-1 rounded-lg bg-card/90 backdrop-blur-xs border border-border shadow-xs">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom In"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom Out"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset Zoom"
          aria-label="Reset Zoom"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <span className="font-mono text-[11px] font-bold px-1.5 text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Floating Drag Hint */}
      <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded bg-card/80 border border-border/60 text-[10px] text-muted-foreground flex items-center gap-1">
        <Move className="w-3 h-3" />
        <span>Drag to pan</span>
      </div>

      {/* Pan & Zoom Canvas */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-6"
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="w-80 rounded border-2 border-dashed border-border/80 bg-card p-6 shadow-md text-foreground font-mono text-xs space-y-3 shrink-0"
        >
          {/* Thermal Receipt Visual Rendering */}
          <div className="text-center border-b border-dashed border-border pb-3">
            <div className="w-8 h-8 rounded-full bg-muted border border-border/80 mx-auto mb-1.5 flex items-center justify-center text-muted-foreground">
              <FileText className="w-4 h-4" />
            </div>
            <p className="font-bold text-sm tracking-tight text-foreground">
              {extracted_values.merchant_name || "OFFICIAL RECEIPT"}
            </p>
            <p className="text-[10px] text-muted-foreground">TIN: 000-112-884-000 • VAT REG</p>
            <p className="text-[10px] text-muted-foreground">
              {exception.receipt_id.toUpperCase()}
            </p>
          </div>

          <div className="space-y-1 text-[11px] border-b border-dashed border-border pb-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">OR #:</span>
              <span className="font-bold text-foreground">{extracted_values.or_number || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DATE:</span>
              <span className="text-foreground">{extracted_values.txn_date || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CATEGORY:</span>
              <span className="text-foreground">{extracted_values.category || "General"}</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-[11px]">
            {extracted_values.subtotal !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">SUBTOTAL:</span>
                <span>{formatPeso(extracted_values.subtotal)}</span>
              </div>
            )}
            {extracted_values.vat_amount !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT 12%:</span>
                <span>{formatPeso(extracted_values.vat_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-border text-foreground">
              <span>TOTAL AMOUNT:</span>
              <span>
                {extracted_values.total_amount !== undefined
                  ? formatPeso(extracted_values.total_amount)
                  : "—"}
              </span>
            </div>
          </div>

          <div className="pt-2 text-center text-[9px] text-muted-foreground uppercase tracking-widest border-t border-dashed border-border">
            *** VERIFIED KATIBAY AUDIT RECORD ***
          </div>
        </div>
      </div>
    </div>
  );
}
