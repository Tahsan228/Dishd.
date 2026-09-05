import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { ACKNOWLEDGMENTS } from "@/lib/market/order-consent";

export const metadata: Metadata = {
  title: "Legal · Dishd",
  description: "How Dishd works, what it does not promise, and what it records.",
};

export default function LegalIndexPage() {
  return (
    <>
      <h1 className="font-display text-3xl text-forest">Legal</h1>
      <p>
        Dishd is a place to find halal home cooks near you and arrange a pickup.
        These pages set out what that does and does not mean.
      </p>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 p-4 text-xs leading-relaxed text-ink">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
        <span>
          <strong className="font-semibold">These are plain-language drafts.</strong>{" "}
          They describe honestly how the software behaves today, which is what a
          reader needs. They have not been reviewed by a lawyer, and food sale,
          cottage-food and consumer-protection rules vary by state and county.
          Have them reviewed for your operating jurisdiction before trading for
          real money.
        </span>
      </div>

      <h2>The three things we ask you to acknowledge</h2>
      <p>
        You accept these individually every time you place an order, not once at
        sign-up, and each acceptance is recorded separately. They are the
        shortest honest summary of what ordering here means:
      </p>
      <ul>
        {ACKNOWLEDGMENTS.map((a) => (
          <li key={a.key}>{a.text}</li>
        ))}
      </ul>

      <h2>The documents</h2>
      <ul>
        <li>
          <Link href="/legal/terms" className="font-medium text-forest underline-offset-2 hover:underline">
            Terms of use
          </Link>{" "}
          — who is selling, what a credibility score is, and what happens when
          something goes wrong.
        </li>
        <li>
          <Link href="/legal/privacy" className="font-medium text-forest underline-offset-2 hover:underline">
            Privacy
          </Link>{" "}
          — what is collected, what is public, and what is deliberately not
          shown.
        </li>
      </ul>
    </>
  );
}
