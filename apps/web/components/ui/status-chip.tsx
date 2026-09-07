import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileSearch,
  ShieldCheck,
  FileEdit,
  Inbox,
  Lock,
  Check,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type KatibayStatus =
  // Receipt statuses
  | "queued"
  | "extracted"
  | "verified"
  | "exception"
  | "approved"
  | "rejected"
  // Activity statuses
  | "draft"
  | "collecting"
  | "review"
  | "closed"
  // Exception statuses
  | "open"
  | "resolved"
  | "waived"
  // Budget / General statuses
  | "on_track"
  | "over_budget"
  | "balanced"
  // Passport statuses
  | "active"
  | "expiring"
  | "expired"
  | "claimed";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  variantClass: string;
}

const STATUS_MAP: Record<KatibayStatus, StatusConfig> = {
  // Receipt statuses
  queued: {
    label: "Queued",
    icon: Clock,
    variantClass: "bg-status-neutral-bg border-status-neutral-border text-status-neutral-text",
  },
  extracted: {
    label: "Extracted",
    icon: FileSearch,
    variantClass: "bg-status-info-bg border-status-info-border text-status-info-text",
  },
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    variantClass: "bg-status-info-bg border-status-info-border text-status-info-text",
  },
  exception: {
    label: "Exception",
    icon: AlertTriangle,
    variantClass: "bg-status-danger-bg border-status-danger-border text-status-danger-text",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    variantClass: "bg-status-danger-bg border-status-danger-border text-status-danger-text",
  },

  // Activity statuses
  draft: {
    label: "Draft",
    icon: FileEdit,
    variantClass: "bg-status-neutral-bg border-status-neutral-border text-status-neutral-text",
  },

  collecting: {
    label: "Collecting",
    icon: Inbox,
    variantClass: "bg-status-warning-bg border-status-warning-border text-status-warning-text",
  },
  review: {
    label: "Under Review",
    icon: FileSearch,
    variantClass: "bg-status-info-bg border-status-info-border text-status-info-text",
  },
  closed: {
    label: "Closed",
    icon: Lock,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },

  // Exception statuses
  open: {
    label: "Open Exception",
    icon: AlertTriangle,
    variantClass: "bg-status-danger-bg border-status-danger-border text-status-danger-text",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },
  waived: {
    label: "Waived",
    icon: Check,
    variantClass: "bg-status-neutral-bg border-status-neutral-border text-status-neutral-text",
  },

  // Budget
  on_track: {
    label: "On Track",
    icon: CheckCircle2,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },
  over_budget: {
    label: "Over Budget",
    icon: AlertTriangle,
    variantClass: "bg-status-danger-bg border-status-danger-border text-status-danger-text",
  },
  balanced: {
    label: "Balanced",
    icon: ShieldCheck,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },

  // Passport
  active: {
    label: "Active Coverage",
    icon: ShieldCheck,
    variantClass: "bg-status-success-bg border-status-success-border text-status-success-text",
  },
  expiring: {
    label: "Expiring Soon",
    icon: AlertTriangle,
    variantClass: "bg-status-warning-bg border-status-warning-border text-status-warning-text",
  },
  expired: {
    label: "Coverage Expired",
    icon: XCircle,
    variantClass: "bg-status-neutral-bg border-status-neutral-border text-status-neutral-text",
  },
  claimed: {
    label: "Claim Filed",
    icon: CheckCircle2,
    variantClass: "bg-status-info-bg border-status-info-border text-status-info-text",
  },
};

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: KatibayStatus | string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusChip({
  status,
  label: customLabel,
  size = "md",
  className,
  ...props
}: StatusChipProps) {
  const config = STATUS_MAP[status as KatibayStatus] || {
    label: status.replace("_", " "),
    icon: HelpCircle,
    variantClass: "bg-status-neutral-bg border-status-neutral-border text-status-neutral-text",
  };

  const Icon = config.icon;
  const displayText = customLabel || config.label;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium border rounded-full tracking-wide select-none",
        config.variantClass,
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <Icon className={cn("shrink-0", iconSizes[size])} aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
}
