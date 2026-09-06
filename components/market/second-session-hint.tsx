"use client";

import { useSyncExternalStore } from "react";
import { ExternalLink, Users } from "lucide-react";

/**
 * The sibling host's URL, or "" when there is not one.
 *
 * Read through useSyncExternalStore because `window.location` is external
 * state: mirroring it into component state would mean setting state inside an
 * effect, which React 19 flags as a cascading render. It returns a string, so
 * an identical value compares equal and never loops.
 */
function siblingUrl(): string {
  const { hostname, protocol, port, pathname } = window.location;
  const other =
    hostname === "localhost" ? "127.0.0.1" : hostname === "127.0.0.1" ? "localhost" : "";
  return other ? `${protocol}//${other}${port ? `:${port}` : ""}${pathname}` : "";
}

/** The address never changes within a page view, so there is nothing to watch. */
const noSubscribe = () => () => {};

/**
 * Signing in as two people at once, for demoing the cook/buyer conversation.
 *
 * A browser keeps one cookie jar per host, not per tab, so signing in on a
 * second tab replaces the session on the first — there is no per-tab session to
 * be had, and no amount of app code changes that.
 *
 * `localhost` and `127.0.0.1` are different hosts to the browser, so they get
 * separate cookie jars while serving the same app from the same server. Opening
 * the second account on the sibling host gives two genuinely independent
 * sessions side by side.
 *
 * Demo-only: this renders solely where the one-click demo accounts do, so it
 * never appears on a real deployment.
 */
export function SecondSessionHint() {
  const sibling = useSyncExternalStore(
    noSubscribe,
    siblingUrl,
    () => "", // The server has no address to offer.
  );

  if (!sibling) return null;

  return (
    <div className="mt-6 rounded-xl border border-brass/40 bg-brass/5 p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold text-brass-ink">
        <Users className="h-3.5 w-3.5" aria-hidden />
        Signed in as two people at once
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        A browser keeps one session per <em>host</em>, not per tab, so signing in
        on a second tab logs the first one out. Open the other account here
        instead — same app, same server, separate session.
      </p>
      <a
        href={sibling}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-brass/50 bg-cream px-4 text-xs font-medium text-brass-ink hover:bg-brass/10"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        Open a second session
      </a>
      <p className="mt-2 text-[11px] text-ink-muted">
        Keep the cook on one host and the buyer on the other, and the order chat
        works between them.
      </p>
    </div>
  );
}
