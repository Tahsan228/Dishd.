"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Phone, Send } from "lucide-react";
import { sendOrderMessage } from "@/lib/market/chat-actions";
// Plain module: constants cannot be exported from a "use server" file.
import { MESSAGE_MAX, type ChatMessage, type SendMessageState } from "@/lib/market/chat";
import { cn } from "@/lib/utils";

const initial: SendMessageState = { ok: false, message: "" };

/**
 * The order thread, between the buyer and the cook.
 *
 * Scoped to one order on purpose: neither side gets a general inbox into the
 * other's life, and when the order is gone so is the thread. Messages are
 * append-only — a conversation about food is a record of what was agreed, and
 * being able to quietly rewrite it later is worse than living with a typo.
 */
export function OrderChat({
  orderId,
  viewerId,
  otherName,
  initialMessages,
  live,
}: {
  orderId: string;
  viewerId: string;
  /** Who the viewer is talking to, for the header and the call button. */
  otherName: string;
  initialMessages: ChatMessage[];
  /** False once the order is finished; the thread stays readable but closes. */
  live: boolean;
}) {
  const [state, action, pending] = useActionState(
    sendOrderMessage.bind(null, orderId),
    initial,
  );
  const [optimistic, addOptimistic] = useOptimistic(
    initialMessages,
    (current, body: string) => [
      ...current,
      {
        id: `pending-${current.length}`,
        order_id: orderId,
        sender_id: viewerId,
        body,
        created_at: new Date().toISOString(),
      },
    ],
  );
  const [callNote, setCallNote] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // New messages arrive by refresh; keep the latest in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [optimistic.length]);

  // A thread only matters while the order is moving, so it polls only then.
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, 10000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [live, router]);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <MessageSquare className="h-4 w-4 text-forest" aria-hidden />
          Messages with {otherName}
        </h2>

        {/* Calling is not built. The button says so rather than pretending, and
            is disabled so a tap during a real pickup cannot look like it
            failed silently. */}
        <span className="relative">
          <button
            type="button"
            aria-disabled="true"
            onClick={() => setCallNote((v) => !v)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-ink-muted hover:border-forest/40 hover:text-forest"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Call
          </button>
          {callNote && (
            <span
              role="status"
              className="expand absolute top-full right-0 z-10 mt-2 w-56 rounded-lg border border-line bg-cream p-3 text-xs leading-relaxed text-ink-muted shadow-lg"
            >
              Calling isn&rsquo;t available yet. Use messages to sort out pickup
              — the cook sees them on their dashboard.
            </span>
          )}
        </span>
      </header>

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {optimistic.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">
            No messages yet. Ask about timing, parking, or anything about the
            food.
          </p>
        ) : (
          optimistic.map((message) => {
            const mine = message.sender_id === viewerId;
            return (
              <div
                key={message.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                    mine
                      ? "rounded-br-sm bg-forest text-cream"
                      : "rounded-bl-sm bg-surface-sunk text-ink",
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <p
                    className={cn(
                      "tabular mt-1 text-[10px]",
                      mine ? "text-cream/60" : "text-ink-muted",
                    )}
                  >
                    {new Date(message.created_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {live ? (
        <form
          ref={formRef}
          action={(formData) => {
            const body = String(formData.get("body") ?? "").trim();
            if (body) addOptimistic(body);
            formRef.current?.reset();
            return action(formData);
          }}
          className="flex items-end gap-2 border-t border-line p-3"
        >
          <label className="flex-1">
            <span className="sr-only">Your message</span>
            <textarea
              name="body"
              rows={1}
              required
              maxLength={MESSAGE_MAX}
              placeholder={`Message ${otherName}…`}
              className="min-h-11 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-cream hover:bg-forest-deep disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      ) : (
        <p className="border-t border-line p-4 text-xs text-ink-muted">
          This order is finished, so the thread is closed. It stays here as a
          record of what was agreed.
        </p>
      )}

      {!state.ok && state.message && (
        <p role="status" className="px-4 pb-4 text-xs text-clay">
          {state.message}
        </p>
      )}
    </section>
  );
}
