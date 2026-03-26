import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * context-budget-monitor
 *
 * Shows a persistent context usage indicator in the footer status bar.
 * Auto-suggests compaction when approaching the context window limit.
 *
 * Replaces the need to manually type /usage (previously called 220+ times).
 */

const WARN_THRESHOLD = 0.75; // 75% — warn
const CRITICAL_THRESHOLD = 0.90; // 90% — strongly suggest compaction

let lastNotifiedThreshold: "none" | "warn" | "critical" = "none";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function getUsageBar(ratio: number, width: number = 10): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export default function (pi: ExtensionAPI) {
  function updateStatus(ctx: { ui: any; getContextUsage: () => any }) {
    const usage = ctx.getContextUsage();
    if (!usage || !usage.contextWindow) {
      ctx.ui.setStatus("ctx-budget", undefined);
      return;
    }

    const tokens = usage.tokens ?? 0;
    const limit = usage.contextWindow;
    const ratio = tokens / limit;

    const bar = getUsageBar(ratio, 8);
    const pct = Math.round(ratio * 100);
    const label = `${formatTokens(tokens)}/${formatTokens(limit)}`;

    let color = "";
    let icon = "📊";

    if (ratio >= CRITICAL_THRESHOLD) {
      color = "🔴";
      icon = "🔴";
    } else if (ratio >= WARN_THRESHOLD) {
      color = "🟡";
      icon = "🟡";
    } else {
      color = "🟢";
      icon = "🟢";
    }

    ctx.ui.setStatus("ctx-budget", `${icon} ${bar} ${pct}% ${label}`);

    // Notifications at threshold crossings
    if (ratio >= CRITICAL_THRESHOLD && lastNotifiedThreshold !== "critical") {
      lastNotifiedThreshold = "critical";
      ctx.ui.notify(
        `Context at ${pct}% (${label}). Consider running /compact to free space.`,
        "warning"
      );
    } else if (
      ratio >= WARN_THRESHOLD &&
      ratio < CRITICAL_THRESHOLD &&
      lastNotifiedThreshold === "none"
    ) {
      lastNotifiedThreshold = "warn";
      ctx.ui.notify(`Context at ${pct}% (${label}). Approaching limit.`, "info");
    } else if (ratio < WARN_THRESHOLD) {
      lastNotifiedThreshold = "none";
    }
  }

  // Update after each turn
  pi.on("turn_end", async (_event, ctx) => {
    updateStatus(ctx);
  });

  // Update on session start (restore)
  pi.on("session_start", async (_event, ctx) => {
    lastNotifiedThreshold = "none";
    // Small delay to let the session fully load
    setTimeout(() => updateStatus(ctx), 500);
  });

  // Update after compaction (usage drops)
  pi.on("session_compact", async (_event, ctx) => {
    lastNotifiedThreshold = "none";
    updateStatus(ctx);
  });

  // Update on agent end
  pi.on("agent_end", async (_event, ctx) => {
    updateStatus(ctx);
  });

  // Clear on shutdown
  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("ctx-budget", undefined);
  });
}
