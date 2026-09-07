import React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react";

export interface ConfidenceBarProps extends React.HTMLAttributes<HTMLDivElement> {
  score: number; // 0.0 to 1.0
  showLabel?: boolean;
  showScore?: boolean;
  compact?: boolean;
}

export interface ConfidenceTier {
  label: string;
  sublabel: string;
  fillClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 0.92) {
    return {
      label: "High Confidence",
      sublabel: "Auto-approved eligible",
      fillClass: "bg-status-success-fill",
      textClass: "text-status-success-text",
      bgClass: "bg-status-success-bg",
      borderClass: "border-status-success-border",
      icon: ShieldCheck,
    };
  }
  if (score >= 0.7) {
    return {
      label: "Review Recommended",
      sublabel: "Soft-flagged for review",
      fillClass: "bg-status-warning-fill",
      textClass: "text-status-warning-text",
      bgClass: "bg-status-warning-bg",
      borderClass: "border-status-warning-border",
      icon: AlertTriangle,
    };
  }
  return {
    label: "Low Confidence",
    sublabel: "Manual check required",
    fillClass: "bg-status-danger-fill",
    textClass: "text-status-danger-text",
    bgClass: "bg-status-danger-bg",
    borderClass: "border-status-danger-border",
    icon: AlertCircle,
  };
}

export function ConfidenceBar({
  score,
  showLabel = true,
  showScore = true,
  compact = false,
  className,
  ...props
}: ConfidenceBarProps) {
  // Clamp between 0 and 1
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(clampedScore * 100);
  const tier = getConfidenceTier(clampedScore);
  const Icon = tier.icon;

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        title={`${tier.label}: ${percentage}%`}
        {...props}
      >
        <div className="w-16 h-2 rounded-full bg-status-neutral-bg border border-status-neutral-border overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-300", tier.fillClass)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showScore && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground font-semibold">
            {percentage}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border flex flex-col gap-2 transition-colors",
        tier.bgClass,
        tier.borderClass,
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-4 h-4 shrink-0", tier.textClass)} />
          <span className={cn("text-xs font-semibold tracking-tight", tier.textClass)}>
            {tier.label}
          </span>
        </div>
        {showScore && (
          <span className="font-mono text-xs font-bold tabular-nums text-foreground">
            {percentage}%
          </span>
        )}
      </div>

      <div className="w-full h-2 rounded-full bg-background/80 border border-border/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", tier.fillClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {showLabel && (
        <p className="text-[11px] text-muted-foreground leading-tight">{tier.sublabel}</p>
      )}
    </div>
  );
}
