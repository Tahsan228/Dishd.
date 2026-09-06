/**
 * Shared chat types and limits.
 *
 * Kept out of chat-actions.ts because a `"use server"` module may only export
 * async functions — a constant exported from one is a build error at best and
 * `undefined` in the client bundle at worst.
 */

export type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type SendMessageState = { ok: boolean; message: string };

export const MESSAGE_MAX = 2000;
