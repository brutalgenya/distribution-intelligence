import { formatLabel, formatNumber, formatPercent } from "../../lib/utils/format";
import type { AnomalySeverity, MetricTone, RiskSeverity } from "./types";

export const formatSeverityLabel = (value: string): string => formatLabel(value);

export const formatSignedNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatNumber(Math.abs(value))}`;
};

export const formatSignedPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatPercent(Math.abs(value))}`;
};

export const formatCompactId = (value: string): string =>
  value.length <= 12 ? value : `${value.slice(0, 8)}...`;

export const getMetricToneClasses = (
  tone: MetricTone,
): { borderClassName: string; accentClassName: string; helperClassName: string } => {
  switch (tone) {
    case "critical":
      return {
        borderClassName: "border-red-200 bg-red-50",
        accentClassName: "text-red-700",
        helperClassName: "text-red-700/80",
      };
    case "warning":
      return {
        borderClassName: "border-amber-200 bg-amber-50",
        accentClassName: "text-amber-800",
        helperClassName: "text-amber-800/80",
      };
    case "positive":
      return {
        borderClassName: "border-pine/20 bg-pine/10",
        accentClassName: "text-pine",
        helperClassName: "text-pine/80",
      };
    case "neutral":
      return {
        borderClassName: "border-black/10 bg-white",
        accentClassName: "text-ink",
        helperClassName: "text-steel",
      };
  }
};

export const getRiskSeverityTone = (
  severity: RiskSeverity,
): { badgeClassName: string; rowClassName: string } => {
  switch (severity) {
    case "critical":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        rowClassName: "border-red-100 bg-red-50/50",
      };
    case "high":
      return {
        badgeClassName: "bg-amber-100 text-amber-800",
        rowClassName: "border-amber-100 bg-amber-50/40",
      };
    case "medium":
      return {
        badgeClassName: "bg-sky-100 text-sky-700",
        rowClassName: "border-sky-100 bg-sky-50/40",
      };
  }
};

export const getAnomalySeverityTone = (
  severity: AnomalySeverity,
): { badgeClassName: string; textClassName: string } => {
  switch (severity) {
    case "high":
      return {
        badgeClassName: "bg-red-100 text-red-700",
        textClassName: "text-red-700",
      };
    case "medium":
      return {
        badgeClassName: "bg-amber-100 text-amber-800",
        textClassName: "text-amber-800",
      };
    case "low":
      return {
        badgeClassName: "bg-sky-100 text-sky-700",
        textClassName: "text-sky-700",
      };
  }
};

export const toShortDateLabel = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
