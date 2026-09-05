"use client";

import { useActionState, useRef } from "react";
import { TriangleAlert, ArrowRight } from "lucide-react";
import { signIn } from "@/lib/market/auth-actions";

/**
 * Seeded demo accounts. Clicking one signs straight in rather than just
 * filling the field — during a demo, a filled-but-unsubmitted form reads as
 * broken.
 */
const DEMO = [
  { email: "yusuf@dishd.test", name: "Yusuf Ali", role: "Buyer · Trusted Taster" },
  { email: "amina@dishd.test", name: "Amina Yusuf", role: "Cook · Dishd Verified" },
  { email: "bilal@dishd.test", name: "Bilal Ahmed", role: "Cook · brand new kitchen" },
];

const DEMO_PASSWORD = "dishd-demo-1234";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null as { error?: string } | null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /**
   * Both fields are uncontrolled, so setting .value and submitting in the same
   * tick is deterministic — there is no React render to wait on and nothing to
   * overwrite the value we just wrote.
   */
  function signInAs(demoEmail: string) {
    if (emailRef.current) emailRef.current.value = demoEmail;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="mt-6">
      <input type="hidden" name="next" value={next} />

      <div className="stagger space-y-2">
        <p className="text-xs font-medium text-ink">Sign in as a demo account</p>
        {DEMO.map((d) => (
          <button
            key={d.email}
            type="button"
            disabled={pending}
            onClick={() => signInAs(d.email)}
            className="lift flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-forest/40 disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-medium text-ink">{d.name}</span>
              <span className="block text-xs text-ink-muted">{d.role}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-forest" aria-hidden />
          </button>
        ))}
      </div>

      <details className="mt-6 rounded-xl border border-line bg-surface-sunk">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-ink">
          Or sign in with an email and password
        </summary>

        <div className="space-y-3 border-t border-line p-4">
          <label className="block">
            <span className="text-xs font-medium text-ink">Email</span>
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={DEMO[0].email}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-forest"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink">Password</span>
            <input
              ref={passwordRef}
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue={DEMO_PASSWORD}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-forest"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-forest px-4 py-3 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </details>

      {state?.error && (
        <p className="rise mt-4 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {state.error === "Invalid login credentials"
              ? "That email and password don't match a Dishd account. The demo accounts above sign in with one click."
              : state.error}
          </span>
        </p>
      )}

      <p className="mt-4 text-center text-[11px] text-ink-muted">
        These are seeded demo accounts, not real people.
      </p>
    </form>
  );
}
