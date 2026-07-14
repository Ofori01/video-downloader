import { CheckCircle2, Clock3, WifiOff } from "lucide-react";

import type { SystemStatusResponse } from "@/types";

interface ServiceStatusPillProps {
  health?: SystemStatusResponse;
  hasError: boolean;
}

export function ServiceStatusPill({
  health,
  hasError,
}: ServiceStatusPillProps) {
  const state = getServiceState(health, hasError);
  const Icon = state.icon;

  return (
    <div
      className="apple-material inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-white/78 px-[var(--spacing-16)] py-[var(--spacing-8)] text-[length:var(--text-caption)] leading-[var(--leading-caption)] tracking-[var(--tracking-caption)] text-carbon backdrop-blur-xl"
      aria-live="polite"
    >
      <Icon className={state.iconClassName} aria-hidden="true" />
      <span>{state.label}</span>
    </div>
  );
}

function getServiceState(
  health: SystemStatusResponse | undefined,
  hasError: boolean,
) {
  if (hasError) {
    return {
      label: "Service is unavailable",
      icon: WifiOff,
      iconClassName: "size-3.5 text-[#b42318]",
    };
  }

  if (!health) {
    return {
      label: "Checking service",
      icon: Clock3,
      iconClassName: "size-3.5 text-ash",
    };
  }

  return {
    label: "Ready to download",
    icon: CheckCircle2,
    iconClassName: "size-3.5 text-[#12643d]",
  };
}
