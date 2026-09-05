import Link from "next/link";
import { SiteHeader } from "@/components/market/site-header";

export async function SocialHeader() {
  return <div className="no-print"><SiteHeader /><nav aria-label="Meal diary navigation" className="mx-auto flex max-w-5xl items-center gap-5 border-b border-line px-4 text-sm text-forest"><Link href="/" className="inline-flex min-h-11 items-center hover:underline">Explore kitchens</Link><Link href="/diary" className="inline-flex min-h-11 items-center font-medium hover:underline">My meal diary</Link></nav></div>;
}
