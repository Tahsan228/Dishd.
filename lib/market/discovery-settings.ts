import { z } from "zod";

export const MEAL_TAGS = [
  { key: "family_trays", label: "Family tray" },
  { key: "ramadan", label: "Ramadan meal" },
  { key: "iftar", label: "Iftar package" },
  { key: "eid", label: "Eid catering" },
] as const;
export type DiscoveryState = { ok: boolean; message: string };
export type MenuDiscoverySettings = { vegetarian_claimed: boolean; serves: number; meal_tags: string[]; offer_title: string | null; offer_expires_at: string | null };
export const menuDiscoverySchema = z.object({
  menu_item_id: z.string().uuid(),
  vegetarian_claimed: z.boolean(),
  serves: z.coerce.number().int().min(1).max(30),
  meal_tags: z.array(z.enum(["family_trays", "ramadan", "iftar", "eid"])).max(4),
  offer_title: z.string().trim().max(80),
  offer_hours: z.coerce.number().int().min(1).max(168),
});
