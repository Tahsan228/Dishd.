import type { OrderStatus } from "@/lib/types";

/**
 * The order state machine, as pure data.
 *
 * Migration 0005 enforces exactly these rules in a BEFORE UPDATE trigger, which
 * is the real boundary — a server action is reachable from the client with
 * arbitrary arguments, so it can never be the only check. This module exists so
 * the rules are unit-testable and so the UI can refuse an illegal move with a
 * sentence a cook can read, instead of surfacing a Postgres exception.
 *
 * Keep in step with 0005. If a transition changes here, change it there too.
 */

export type OrderActor = "cook" | "buyer";

/** Once an order reaches one of these it never changes again. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "cancelled", "declined"];

const COOK_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["accepted", "declined"],
  accepted: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
};

/**
 * A buyer may only walk away, and only before the food is made ready. They may
 * never mark an order completed: completing is what mints a verified log, so
 * letting the buyer do it would make ratings farmable.
 */
const BUYER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["cancelled"],
  accepted: ["cancelled"],
};

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Every move `actor` is allowed to make from `from`. */
export function allowedTransitions(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  const table = actor === "cook" ? COOK_TRANSITIONS : BUYER_TRANSITIONS;
  return table[from] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return allowedTransitions(from, actor).includes(to);
}

/** Null when the move is legal, otherwise the reason to show the actor. */
export function transitionError(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderActor,
): string | null {
  if (from === to) return "That order is already in this state.";
  if (isTerminal(from)) return `This order is already ${from} and cannot change again.`;
  if (canTransition(from, to, actor)) return null;
  if (actor === "buyer") {
    return to === "completed"
      ? "Only the cook can mark an order collected."
      : "You can only cancel an order before it has been made ready.";
  }
  return `An order cannot go from ${from} to ${to}.`;
}
