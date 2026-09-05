import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../types";
import {
  allowedTransitions,
  canTransition,
  isTerminal,
  transitionError,
  TERMINAL_STATUSES,
} from "./order-lifecycle";

const ALL: OrderStatus[] = ["pending", "accepted", "ready", "completed", "cancelled", "declined"];

describe("the cook's state machine", () => {
  it("walks pending -> accepted -> ready -> completed one step at a time", () => {
    expect(canTransition("pending", "accepted", "cook")).toBe(true);
    expect(canTransition("accepted", "ready", "cook")).toBe(true);
    expect(canTransition("ready", "completed", "cook")).toBe(true);
  });

  it("refuses to skip straight to completed", () => {
    // A pickup that was never accepted or made ready did not happen, and
    // completing is what mints the verified log.
    expect(canTransition("pending", "completed", "cook")).toBe(false);
    expect(canTransition("accepted", "completed", "cook")).toBe(false);
  });

  it("lets the cook decline only while the order is still pending", () => {
    expect(canTransition("pending", "declined", "cook")).toBe(true);
    expect(canTransition("accepted", "declined", "cook")).toBe(false);
    expect(canTransition("ready", "declined", "cook")).toBe(false);
  });

  it("lets the cook cancel after accepting but not before", () => {
    expect(canTransition("accepted", "cancelled", "cook")).toBe(true);
    expect(canTransition("ready", "cancelled", "cook")).toBe(true);
    expect(canTransition("pending", "cancelled", "cook")).toBe(false);
  });

  it("never walks backwards", () => {
    expect(canTransition("ready", "accepted", "cook")).toBe(false);
    expect(canTransition("accepted", "pending", "cook")).toBe(false);
  });
});

describe("the buyer's powers", () => {
  // This is the exploit migration 0005 closes. A buyer who can complete their
  // own order can mint a verified review and add to the kitchen's revenue
  // without any food changing hands.
  it("cannot mark an order completed from any state", () => {
    for (const from of ALL) {
      expect(canTransition(from, "completed", "buyer")).toBe(false);
    }
  });

  it("cannot accept, ready or decline an order", () => {
    for (const from of ALL) {
      for (const to of ["accepted", "ready", "declined"] as OrderStatus[]) {
        expect(canTransition(from, to, "buyer")).toBe(false);
      }
    }
  });

  it("may cancel before the food is made ready, and not after", () => {
    expect(canTransition("pending", "cancelled", "buyer")).toBe(true);
    expect(canTransition("accepted", "cancelled", "buyer")).toBe(true);
    expect(canTransition("ready", "cancelled", "buyer")).toBe(false);
  });

  it("explains the refusal in words a buyer can act on", () => {
    expect(transitionError("ready", "completed", "buyer")).toBe(
      "Only the cook can mark an order collected.",
    );
    expect(transitionError("ready", "cancelled", "buyer")).toBe(
      "You can only cancel an order before it has been made ready.",
    );
  });
});

describe("terminal states", () => {
  it("treats completed, cancelled and declined as final", () => {
    expect(TERMINAL_STATUSES).toEqual(["completed", "cancelled", "declined"]);
    for (const s of TERMINAL_STATUSES) expect(isTerminal(s)).toBe(true);
    for (const s of ["pending", "accepted", "ready"] as OrderStatus[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it("allows nobody any move out of a terminal state", () => {
    for (const from of TERMINAL_STATUSES) {
      expect(allowedTransitions(from, "cook")).toEqual([]);
      expect(allowedTransitions(from, "buyer")).toEqual([]);
      for (const to of ALL) {
        expect(canTransition(from, to, "cook")).toBe(false);
        expect(canTransition(from, to, "buyer")).toBe(false);
      }
    }
  });

  it("says so rather than silently failing", () => {
    // A cancelled order walked back to completed would re-mint a verified log.
    expect(transitionError("cancelled", "completed", "cook")).toBe(
      "This order is already cancelled and cannot change again.",
    );
  });
});

describe("transitionError agrees with canTransition", () => {
  it("returns null exactly when the move is allowed", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        for (const actor of ["cook", "buyer"] as const) {
          const allowed = canTransition(from, to, actor);
          expect(transitionError(from, to, actor) === null).toBe(allowed);
        }
      }
    }
  });

  it("rejects a no-op move", () => {
    for (const s of ALL) {
      expect(transitionError(s, s, "cook")).toBe("That order is already in this state.");
    }
  });
});
