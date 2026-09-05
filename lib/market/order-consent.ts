/**
 * Order-time consent wording.
 *
 * Plain module, not a server action file: "use server" modules may only export
 * async functions, and both the client form and the server action need these.
 *
 * Bump ACK_VERSION whenever any wording below changes. Every acceptance is
 * recorded against the version in force at the time, which is what makes the
 * agreements table usable as evidence.
 */
export const ACK_VERSION = "2026-09-05.1";

export const ACKNOWLEDGMENTS = [
  {
    key: "home_kitchen",
    text: "I understand this food is prepared in a private home kitchen that is not routinely inspected by a health department.",
  },
  {
    key: "allergens",
    text: "I have read the allergen information and accept the risk of cross-contamination in a home kitchen.",
  },
  {
    key: "halal",
    text: "I understand Dishd does not certify halal status; sourcing claims are made by the cook.",
  },
] as const;
