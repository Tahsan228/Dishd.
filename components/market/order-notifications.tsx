"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { formatClock } from "@/lib/market/order-timing";
import { cn } from "@/lib/utils";

/**
 * Buyer alerts for one order, and the page's only poller.
 *
 * Notifications are browser notifications, granted per device, so the switch
 * lives in localStorage rather than in a table: a preference stored server-side
 * would claim to reach a phone that never granted permission and holds no
 * subscription. What this genuinely delivers is an alert while Dishd is open
 * somewhere in the browser, including in a background tab — which is the case
 * that matters, because a notification you only see while already looking at
 * the page is not a notification.
 *
 * That is also why this component owns the refresh timer. The page previously
 * polled only while visible, so a backgrounded tab learned nothing and had
 * nothing to announce. Here the timer keeps running while hidden, but only when
 * alerts are switched on, and slows down when it does.
 *
 * What is deliberately NOT claimed anywhere in this UI: delivery when Dishd is
 * closed. That needs a service worker, a push subscription and VAPID keys this
 * deployment does not have, so the copy says "while Dishd is open" and means it.
 */

const VISIBLE_POLL_MS = 8_000;
const HIDDEN_POLL_MS = 20_000;
const TITLE_FLAG = "● ";

/* -------------------------------------------------------------------------- */
/* Permission and the stored switch are both browser state that React does not
 * own, so they are read through useSyncExternalStore rather than copied into
 * component state by a mount effect. That keeps the server render honest — it
 * has no localStorage and no Notification API — and means a change made in
 * another tab is picked up here.                                             */

const listeners = new Set<() => void>();

/** Used when localStorage throws, which private windows and blocked site data do. */
const inMemory = new Map<string, string>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function announce() {
  for (const listener of listeners) listener();
}

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? inMemory.get(key) ?? "off";
  } catch {
    return inMemory.get(key) ?? "off";
  }
}

function writeStored(key: string, value: string) {
  inMemory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Remembered for this visit only. The switch still works.
  }
}

/**
 * One primitive string, so the snapshot is stable without memoisation:
 * "unsupported", or "<permission>:<on|off>".
 *
 * Permission can be revoked in browser settings long after the switch was set,
 * so a stored "on" only counts while permission still holds.
 */
function readSnapshot(key: string): string {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const permission = Notification.permission;
  return `${permission}:${permission === "granted" && readStored(key) === "on" ? "on" : "off"}`;
}

/* -------------------------------------------------------------------------- */

/** What each arrival should say, as a sentence a person would read. */
function statusAlert(
  status: OrderStatus,
  kitchenName: string,
): { title: string; body: string } | null {
  switch (status) {
    case "accepted":
      return {
        title: `${kitchenName} accepted your order`,
        body: "The pickup address is now on your order page.",
      };
    case "ready":
      return {
        title: "Your food is ready",
        body: `Collect it from ${kitchenName} and show your pickup code.`,
      };
    case "completed":
      return { title: "Collected", body: "This meal is in your diary. You can rate it now." };
    case "cancelled":
      return {
        title: "Your order was cancelled",
        body: `${kitchenName} is no longer preparing it.`,
      };
    case "declined":
      return {
        title: `${kitchenName} declined your order`,
        body: "Nothing has been charged for the food.",
      };
    default:
      return null;
  }
}

export function OrderNotifications({
  orderId,
  kitchenName,
  status,
  active,
  latestMessageId,
  latestMessageFromOther,
  readyEstimate,
}: {
  orderId: string;
  kitchenName: string;
  status: OrderStatus;
  /** False once the order is finished; nothing more will arrive. */
  active: boolean;
  latestMessageId: string | null;
  /** True when the newest message came from the kitchen rather than the buyer. */
  latestMessageFromOther: boolean;
  /** ISO instant, so a revised estimate is simply a changed string. */
  readyEstimate: string | null;
}) {
  const router = useRouter();
  const storageKey = `dishd:notify:${orderId}`;

  const snapshot = useSyncExternalStore(
    subscribe,
    () => readSnapshot(storageKey),
    // The server has neither API. "default" renders the ordinary invitation,
    // which is what almost every visitor will see a moment later anyway.
    () => "default:off",
  );
  const [permission, stored] = snapshot === "unsupported" ? ["unsupported", "off"] : snapshot.split(":");
  const enabled = stored === "on";

  const hidden = useSyncExternalStore(
    (callback) => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
    () => document.visibilityState === "hidden",
    () => false,
  );

  const notify = useCallback(
    (title: string, body: string) => {
      // The tab title is the fallback for a buyer who declined permission but
      // still has Dishd open behind something else. Writing to document is
      // updating an external system, not React state.
      if (document.visibilityState === "hidden" && !document.title.startsWith(TITLE_FLAG)) {
        document.title = TITLE_FLAG + document.title;
      }
      if (!enabled) return;
      try {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        // One tag per order, so a burst of updates replaces itself rather than
        // stacking five banners about the same pickup.
        new Notification(title, { body, tag: `dishd-order-${orderId}` });
      } catch {
        // Some browsers throw on construction in an insecure context. The page
        // has already refreshed, so the update itself is not lost.
      }
    },
    [enabled, orderId],
  );

  /**
   * One effect watches everything that can change. The first pass only records
   * what was on screen at load, so opening the page never announces itself.
   */
  const seen = useRef<{ status: OrderStatus; messageId: string | null; estimate: string | null } | null>(null);
  useEffect(() => {
    const previous = seen.current;
    seen.current = { status, messageId: latestMessageId, estimate: readyEstimate };
    if (!previous) return;

    if (previous.status !== status) {
      const alert = statusAlert(status, kitchenName);
      if (alert) notify(alert.title, alert.body);
    }

    if (latestMessageId && previous.messageId !== latestMessageId && latestMessageFromOther) {
      notify(`Message from ${kitchenName}`, "Open your order to read and reply.");
    }

    // Only news while the food is still coming. An estimate written at the
    // moment of collection is not worth interrupting anyone for.
    if (previous.estimate !== readyEstimate && readyEstimate && status !== "completed") {
      notify(
        `${kitchenName} updated the cooking time`,
        `Now ready by about ${formatClock(new Date(readyEstimate))}.`,
      );
    }
  }, [status, latestMessageId, latestMessageFromOther, readyEstimate, kitchenName, notify]);

  // Coming back to the tab is the acknowledgement, so the flag clears itself.
  useEffect(() => {
    if (hidden) return;
    while (document.title.startsWith(TITLE_FLAG)) {
      document.title = document.title.slice(TITLE_FLAG.length);
    }
  }, [hidden]);

  // The poller. Runs while the tab is visible, and keeps running in the
  // background only when there are alerts to deliver.
  useEffect(() => {
    if (!active) return;
    if (hidden && !enabled) return;
    const refresh = () => router.refresh();
    const timer = window.setInterval(refresh, hidden ? HIDDEN_POLL_MS : VISIBLE_POLL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [active, hidden, enabled, router]);

  const toggle = async () => {
    if (enabled) {
      writeStored(storageKey, "off");
      announce();
      return;
    }
    if (permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        return;
      }
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      writeStored(storageKey, "on");
    }
    // Announced either way: a refusal has to move the UI off "Notify me" too.
    announce();
  };

  if (!active) return null;

  const blocked = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
            {enabled ? (
              <BellRing className="h-4 w-4 shrink-0 text-forest" aria-hidden />
            ) : (
              <Bell className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            )}
            Tell me when this changes
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {unsupported
              ? "This browser does not support notifications. The page still updates on its own while it is open."
              : blocked
                ? "Notifications are blocked for Dishd in your browser settings. Allow them there to switch this on."
                : enabled
                  ? `On for status changes, messages from ${kitchenName}, and changes to the cooking time — while Dishd is open in this browser, including in a background tab.`
                  : `Get a notification when ${kitchenName} updates your order or sends a message, while Dishd is open in this browser.`}
          </p>
        </div>

        {!unsupported && !blocked && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
              enabled
                ? "border border-forest bg-forest-soft text-forest"
                : "bg-forest text-cream hover:bg-forest-deep",
            )}
          >
            {enabled ? "Alerts on" : "Notify me"}
          </button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {enabled ? "Order notifications are on." : "Order notifications are off."}
      </p>
    </section>
  );
}
