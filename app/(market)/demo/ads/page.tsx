import Link from "next/link";
import { SiteHeader } from "@/components/market/site-header";
import { DEMO_ADS, DemoAd } from "@/components/market/demo-ad";

export const metadata = { title: "Demo sponsors | Dishd" };

export default function DemoAdsPage() {
  return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <p className="text-sm font-medium text-brass-ink">Advertising preview</p>
    <h1 className="mt-2 font-display text-4xl text-forest">Room for local favorites</h1>
    <p className="mt-4 max-w-xl text-base text-ink-muted">These fictional promotions show how neighborhood sponsors could appear on Dishd. No purchases, paid placements, or advertiser tracking are enabled.</p>
    {DEMO_ADS.map((ad, i) => <section key={ad.slug} id={ad.slug} className="scroll-mt-24"><DemoAd variant={i} /></section>)}
    <Link href="/cook" className="mt-8 inline-block py-3 text-sm text-forest underline">Back to your kitchen</Link>
  </main></>;
}
