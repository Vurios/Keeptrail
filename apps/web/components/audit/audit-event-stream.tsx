"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Cpu, ArrowLeft, FileCode } from "lucide-react";
import { type AuditEventItem, SEED_AUDIT_EVENTS, ACTIVITY_SUMMIT } from "@/lib/data";

interface AuditEventStreamProps {
  activityId?: string;
  initialEvents?: AuditEventItem[];
}

export function AuditEventStream({
  activityId = "act-summit-2026",
  initialEvents = SEED_AUDIT_EVENTS,
}: AuditEventStreamProps) {
  const [events] = useState<AuditEventItem[]>(initialEvents);
  const [selectedEntity, setSelectedEntity] = useState<string>("all");

  const filteredEvents = events.filter((e) => {
    if (selectedEntity === "all") return true;
    return e.entity_type === selectedEntity;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <Link
            href={`/activities/${activityId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-2 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-hidden rounded px-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Activity Reconciliation</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Immutable Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              {ACTIVITY_SUMMIT.title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Chronological cryptographic record of all operations, OCR extractions, exception
            resolutions, approvals, and report exports.
          </p>
        </div>

        {/* Entity Filter Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border self-start md:self-auto">
          {["all", "activities", "receipts", "exceptions", "passports", "reports"].map((ent) => (
            <button
              key={ent}
              type="button"
              onClick={() => setSelectedEntity(ent)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors capitalize ${
                selectedEntity === ent
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ent}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Stream Timeline */}
      <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-4 sm:before:left-6 before:w-0.5 before:bg-border">
        {filteredEvents.map((event) => {
          const isSystemActor =
            !event.actor_id ||
            event.actor_role === "System Pipeline" ||
            event.actor_role === "Rule Engine";

          return (
            <div key={event.id} className="relative pl-10 sm:pl-14 group">
              {/* Timeline Dot */}
              <div className="absolute left-2.5 sm:left-4.5 top-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-brand-primary bg-card group-hover:bg-brand-accent transition-colors shadow-xs" />

              <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-4">
                {/* Event Meta Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center ${
                        isSystemActor
                          ? "bg-muted text-foreground"
                          : "bg-brand-primary/10 text-brand-primary"
                      }`}
                    >
                      {isSystemActor ? <Cpu className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {event.actor_name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                          {event.actor_role}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {event.occurred_at}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-brand-accent">
                      {event.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                      {event.entity_type}:{event.entity_id}
                    </span>
                  </div>
                </div>

                {/* High-Contrast Monospace Before/After Diff View */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5 text-brand-accent" />
                      <span>State Transition Diff</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Format: Unified RFC Diff
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0d1411] border border-border text-xs font-mono text-gray-100 overflow-x-auto space-y-1">
                    {/* Before State (Removals marked with explicit '-' prefix, strikethrough styling, and textured red border) */}
                    {event.before &&
                      Object.entries(event.before).map(([k, v]) => (
                        <div
                          key={`before-${k}`}
                          className="p-1 rounded bg-status-danger-bg/20 border-l-2 border-status-danger-border text-status-danger-text flex items-start gap-2 font-bold"
                        >
                          <span className="text-status-danger-text select-none shrink-0 font-black">
                            - [REMOVED]
                          </span>
                          <span className="line-through opacity-85">
                            {k}: {JSON.stringify(v)}
                          </span>
                        </div>
                      ))}

                    {/* After State (Additions marked with explicit '+' prefix, bold font weight, and textured green border) */}
                    {event.after &&
                      Object.entries(event.after).map(([k, v]) => (
                        <div
                          key={`after-${k}`}
                          className="p-1 rounded bg-status-success-bg/20 border-l-2 border-status-success-border text-status-success-text flex items-start gap-2 font-bold"
                        >
                          <span className="text-status-success-text select-none shrink-0 font-black">
                            + [ADDED]
                          </span>
                          <span>
                            {k}: {JSON.stringify(v)}
                          </span>
                        </div>
                      ))}

                    {!event.before && !event.after && (
                      <div className="text-muted-foreground italic text-[11px]">
                        No state mutation recorded for this event.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
