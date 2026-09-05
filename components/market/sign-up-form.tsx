"use client";

import { useActionState, useState } from "react";
import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { signUp } from "@/lib/market/auth-actions";
import { normaliseHandle, PASSWORD_MIN } from "@/lib/market/account";
import { cn } from "@/lib/utils";

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, { ok: false, message: "" });

  // Controlled so a returned validation error does not wipe what was typed,
  // and so the handle preview can show what the URL will actually be.
  const [draft, setDraft] = useState({
    displayName: "",
    handle: "",
    email: "",
    password: "",
    city: "",
  });

  const handlePreview = normaliseHandle(draft.handle);

  if (state.ok && state.message) {
    return (
      <p className="rise mt-6 flex items-start gap-2 rounded-xl border border-forest/30 bg-forest-soft p-4 text-sm text-forest">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-xs font-medium text-ink">Your name</span>
        <input
          name="displayName"
          autoComplete="name"
          required
          value={draft.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
          aria-invalid={!!state.errors?.displayName}
          className={field}
        />
        {state.errors?.displayName && (
          <span className="mt-1 block text-xs text-clay">{state.errors.displayName}</span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Handle</span>
        <input
          name="handle"
          autoComplete="username"
          required
          value={draft.handle}
          onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
          placeholder="yusuf"
          aria-invalid={!!state.errors?.handle}
          aria-describedby="handle-help"
          className={field}
        />
        <span
          id="handle-help"
          className={cn("mt-1 block text-xs", state.errors?.handle ? "text-clay" : "text-ink-muted")}
        >
          {state.errors?.handle ??
            (handlePreview
              ? `Your profile will live at /u/${handlePreview}`
              : "3–20 letters, numbers or underscores.")}
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          aria-invalid={!!state.errors?.email}
          className={field}
        />
        {state.errors?.email && (
          <span className="mt-1 block text-xs text-clay">{state.errors.email}</span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          aria-invalid={!!state.errors?.password}
          aria-describedby="password-help"
          className={field}
        />
        <span
          id="password-help"
          className={cn("mt-1 block text-xs", state.errors?.password ? "text-clay" : "text-ink-muted")}
        >
          {state.errors?.password ?? `At least ${PASSWORD_MIN} characters.`}
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">
          City <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          name="city"
          autoComplete="address-level2"
          value={draft.city}
          onChange={(e) => setDraft({ ...draft, city: e.target.value })}
          placeholder="Fremont, CA"
          className={field}
        />
      </label>

      {!state.ok && state.message && (
        <p className="rise flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-full bg-forest px-4 py-3 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Create account"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-ink-muted">
        Dishd does not certify halal status or inspect home kitchens. You will
        confirm what that means before your first order. See our{" "}
        <a href="/legal/terms" className="underline underline-offset-2 hover:text-forest">
          terms
        </a>{" "}
        and{" "}
        <a href="/legal/privacy" className="underline underline-offset-2 hover:text-forest">
          privacy notice
        </a>
        .
      </p>
    </form>
  );
}
