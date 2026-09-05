import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use · Dishd",
  description: "Who is selling, what a credibility score means, and what Dishd does not promise.",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-3xl text-forest">Terms of use</h1>
      <p className="text-xs text-ink-muted">
        Plain-language draft. Not reviewed by a lawyer — see the note on the{" "}
        <a href="/legal" className="underline">legal overview</a>.
      </p>

      <h2>1. What Dishd is</h2>
      <p>
        Dishd lists home kitchens and takes pickup orders on their behalf. The
        cook is the seller. Dishd does not cook, package, store, transport or
        inspect any food, and does not employ the cooks who do.
      </p>

      <h2>2. Home kitchens are not inspected restaurants</h2>
      <p>
        Food sold here is prepared in a private residence that is not routinely
        inspected by a health department. Some cooks hold a local home-kitchen
        permit, and where a permit has been checked the kitchen shows a verified
        permit mark. A kitchen without that mark has not had one checked.
      </p>
      <p>
        Cross-contamination is a normal condition of a home kitchen. If you have
        a food allergy, treat every listing as potentially exposed to every
        allergen, whatever the description says.
      </p>

      <h2>3. Halal sourcing is the cook&rsquo;s claim, not our certification</h2>
      <p>
        Dishd does not certify any food as halal and is not a certifying body.
        What Dishd does is narrower and worth understanding precisely: a cook
        declares where they bought their meat and uploads the receipt. Automatic
        checks reject duplicate images, receipts reused across kitchens, stores
        the kitchen never registered, and receipts too old for the batch. What
        passes is then confirmed by a human reviewer before a batch counts as
        verified.
      </p>
      <p>
        That establishes a purchase record. It does not inspect the meat, the
        slaughter, the supply chain behind the shop, or what happened in the
        kitchen afterwards. A verified sourcing badge means the paperwork holds
        up, and nothing more.
      </p>

      <h2>4. Orders, payment and cancellation</h2>
      <ul>
        <li>Placing an order sends a request. The cook accepts or declines it.</li>
        <li>
          The exact pickup address is released only once the cook has accepted.
          This is enforced by the database, not by the page.
        </li>
        <li>
          Payment is currently cash at pickup. Dishd does not hold your money or
          process a card, so there is nothing for us to refund — a dispute about
          a meal is between you and the cook.
        </li>
        <li>
          You can cancel while an order is still pending or accepted. Once the
          cook has marked it ready they may have already cooked it, so
          cancellation is theirs to offer.
        </li>
        <li>
          Only the cook can mark an order collected, because collection is what
          makes the resulting review count.
        </li>
      </ul>

      <h2>5. Reviews and the credibility record</h2>
      <p>
        A review is created automatically when a pickup is completed, so every
        verified review is backed by a real order. You control what your review
        says — the rating, the words, the photo, the sourcing answer — and you
        cannot change whether it counts as verified. That is set by the system
        and restored on every edit.
      </p>
      <p>
        A kitchen&rsquo;s credibility score is computed from its own operating
        record: completed orders, average rating, verified sourcing streak,
        permit status, repeat customers, how long it has traded, less upheld
        flags, open incidents and cancellations. The full breakdown is shown on
        every kitchen page. It is a description of a trading history, not an
        endorsement, a safety rating, or a credit score, and no third party
        should treat it as one.
      </p>

      <h2>6. Conduct, suspension and the public record</h2>
      <p>
        Do not misrepresent sourcing, submit a receipt you did not obtain, post
        someone else&rsquo;s address or pickup code, or use another
        person&rsquo;s account. Accounts and kitchens that break these rules can
        be suspended or removed.
      </p>
      <p>
        A removed kitchen keeps its public page, marked as removed and with the
        reason shown. That is deliberate: a credibility record that could be
        deleted by the person it describes would be worth nothing.
      </p>

      <h2>7. What we do not promise</h2>
      <p>
        Dishd is provided as-is. We do not promise that any listing is accurate,
        that a cook will accept or fulfil an order, that food will meet your
        expectations or dietary requirements, or that the service will be
        available without interruption. Nothing here limits liability that
        cannot lawfully be limited, including for death or personal injury
        caused by negligence.
      </p>

      <h2>8. Changes</h2>
      <p>
        When the order acknowledgments change, the version is incremented and
        recorded. Your past acceptances stay attached to the wording that was in
        force when you agreed to them.
      </p>
    </>
  );
}
