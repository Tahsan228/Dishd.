import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Dishd",
  description: "What Dishd collects, what is public, and what is deliberately never shown.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-display text-3xl text-forest">Privacy</h1>
      <p className="text-xs text-ink-muted">
        Plain-language draft. Not reviewed by a lawyer — see the note on the{" "}
        <a href="/legal" className="underline">legal overview</a>.
      </p>

      <h2>What is collected</h2>
      <ul>
        <li>
          <strong>Account.</strong> Email address, display name, handle, and
          optionally a city and a short bio.
        </li>
        <li>
          <strong>Orders.</strong> What you ordered, from whom, the amount, the
          pickup code, and the times the order changed state.
        </li>
        <li>
          <strong>Reviews.</strong> Your rating, review text, any photo you
          attach, and your answer to the sourcing question.
        </li>
        <li>
          <strong>Consent records.</strong> Each time you accept the three order
          acknowledgments, Dishd stores which statement you accepted, the
          document version, the time, <strong>your IP address and your browser
          user-agent string</strong>. This is the evidence that the disclosure
          was actually made, which is the point of recording it per order rather
          than once at sign-up.
        </li>
        <li>
          <strong>Cook-side records.</strong> If you sell, this includes your
          kitchen address, permit status, and the sourcing receipts you upload.
        </li>
      </ul>

      <h2>What is public</h2>
      <p>
        Your handle, display name, city, bio, avatar, and your reviews with any
        photos — along with the kitchens you have eaten at, which is the point
        of a public meal diary. Assume anything on your profile page can be read
        by anyone, including people who are not signed in.
      </p>
      <p>
        For a kitchen: its name, neighbourhood, menu, badges, credibility score
        and full score breakdown, and its review history. If a kitchen is
        removed, that fact and its reason stay public permanently.
      </p>

      <h2>What is deliberately not shown</h2>
      <ul>
        <li>
          <strong>Exact kitchen addresses.</strong> Held in a separate table and
          released only to the kitchen&rsquo;s owner and to a buyer whose order
          has been accepted. This is enforced in the database, so a bug in a
          page cannot leak one.
        </li>
        <li>
          <strong>Sourcing receipts.</strong> A receipt is a cook&rsquo;s
          purchase record. Stored in a private bucket, readable by the cook who
          uploaded it and by a reviewer.
        </li>
        <li>
          <strong>Email addresses and pickup codes.</strong> Never shown on a
          public page.
        </li>
      </ul>

      <h2>Who else touches your data</h2>
      <p>
        Dishd runs on Supabase, which hosts the database, authentication and
        file storage. Uploaded review photos are served from a public URL, so
        anyone holding that link can view the image — do not upload a photo you
        would not put on a public page.
      </p>
      <p>Dishd does not sell personal data and does not run advertising.</p>

      <h2>Keeping and deleting</h2>
      <p>
        Deleting your account removes your profile and, with it, your reviews
        and diary. Two things are kept on purpose: consent records, which exist
        precisely to show a disclosure was made and would be worthless if the
        person could erase them, and the public record of a kitchen removed for
        cause.
      </p>
      <p>
        Depending on where you live you may have rights to access, correct,
        export or delete your data, and to object to some processing. To ask for
        any of these, or about anything on this page, contact the operator of
        this Dishd deployment.
      </p>
    </>
  );
}
