"use client";

import {
  ScalesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn, getBadgeColors } from "@/lib/utils";
import { type BadgeSize, baseBadge, sizeClasses } from "./shared";

const consensusConfig: Record<
  string,
  {
    hue: number;
    saturation?: number;
    label: string;
    icon: ComponentType<{ weight?: IconWeight; className?: string }>;
  }
> = {
  consensus: {
    hue: 150,
    label: "Consensus",
    icon: CheckCircleIcon,
  },
  split: {
    hue: 30,
    label: "Split",
    icon: ScalesIcon,
  },
  pending: {
    hue: 210,
    label: "Pending Evals",
    icon: ClockIcon,
  },
  rejected: {
    hue: 0,
    label: "Rejected",
    icon: XCircleIcon,
  },
};

export function ConsensusStatusBadge({
  status,
  size = "default",
}: {
  status: string;
  size?: BadgeSize;
}) {
  const config = consensusConfig[status] ?? consensusConfig.pending!;
  const colors = getBadgeColors(config.hue, config.saturation);
  const Icon = config.icon;

  return (
    <span
      className={cn(baseBadge, sizeClasses[size], "gap-1")}
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      }}
    >
      <Icon weight="bold" className="size-3" />
      {config.label}
    </span>
  );
}

export function EvaluatorAgreementBadge({
  agreed,
  size = "sm",
}: {
  agreed: boolean;
  size?: BadgeSize;
}) {
  const hue = agreed ? 150 : 0;
  const colors = getBadgeColors(hue);
  const Icon = agreed ? CheckCircleIcon : XCircleIcon;
  const label = agreed ? "Agreed" : "Disagreed";

  return (
    <span
      className={cn(baseBadge, sizeClasses[size], "gap-1")}
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      }}
    >
      <Icon weight="bold" className="size-3" />
      {label}
    </span>
  );
}
