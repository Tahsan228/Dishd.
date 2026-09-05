"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { signIn } from "@/lib/market/auth-actions";

/** Seeded demo accounts. Removing the seed removes the reason for this block. */
const DEMO = [
  { email: "yusuf@dishd.test", label: "Yusuf — buyer" },
  { email: "amina@dishd.test", label: "Amina — cook (Dishd Verified)" },
  { email: "bilal@dishd.test", label: "Bilal — cook (new kitchen)" },
];

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null as { error?: string } | null);
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-xs font-medium text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-forest"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Password</span>
        <input
          name="password"
          type="password"
          required
          defaultValue="dishd-demo-1234"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-forest"
        />
      </label>

      {state?.error && (
        <p className="rise flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-2.5 text-xs text-clay">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-forest px-4 py-3 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="stagger space-y-1.5 rounded-lg bg-surface-sunk p-3">
        <p className="text-xs font-medium text-ink">Demo accounts</p>
        {DEMO.map((d) => (
          <button
            key={d.email}
            type="button"
            onClick={() => setEmail(d.email)}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-ink-muted hover:bg-forest-soft hover:text-forest"
          >
            {d.label}
          </button>
        ))}
        <p className="pt-1 text-[11px] text-ink-muted">Password is prefilled.</p>
      </div>
    </form>
  );
}
