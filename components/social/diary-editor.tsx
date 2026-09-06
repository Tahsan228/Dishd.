"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ImagePlus, Palette, Pencil, TriangleAlert, X } from "lucide-react";
import { saveProfile } from "@/lib/social/profile-actions";
import { ACCENTS, type ProfileFormState } from "@/lib/social/profile";
import { PHOTO_ACCEPT } from "@/lib/social/review-validation";
import { cn } from "@/lib/utils";

const initial: ProfileFormState = { ok: false, message: "" };

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

/**
 * Diary customisation, shown only to the owner.
 *
 * Collapsed by default: this is somebody's diary first and a settings screen a
 * distant second, so the controls stay out of the way until asked for.
 */
export function DiaryEditor({
  displayName,
  tagline,
  bio,
  city,
  accent,
  avatarUrl,
  bannerUrl,
}: {
  displayName: string;
  tagline: string;
  bio: string;
  city: string;
  accent: string;
  avatarUrl: string;
  bannerUrl: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, initial);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ displayName, tagline, bio, city, accent, avatarUrl, bannerUrl });
  const [names, setNames] = useState({ avatar: "", banner: "" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-ink-muted hover:border-forest hover:text-forest"
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Customise your diary
      </button>
    );
  }

  return (
    <form action={action} className="expand rounded-2xl border border-forest/30 bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl text-forest">Customise your diary</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-muted hover:border-forest hover:text-forest"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <label className="mt-5 block">
        <span className="text-xs font-medium text-ink">Display name</span>
        <input
          name="displayName"
          required
          value={v.displayName}
          onChange={(e) => setV({ ...v, displayName: e.target.value })}
          className={field}
        />
        {state.errors?.displayName && (
          <span className="mt-1 block text-xs text-clay">{state.errors.displayName}</span>
        )}
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-ink">
          Tagline <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          name="tagline"
          maxLength={80}
          placeholder="Always hunting the best biryani in Bergen"
          value={v.tagline}
          onChange={(e) => setV({ ...v, tagline: e.target.value })}
          className={field}
        />
        <span className="tabular mt-1 block text-right text-[11px] text-ink-muted">
          {v.tagline.length}/80
        </span>
      </label>

      <label className="mt-2 block">
        <span className="text-xs font-medium text-ink">
          About you <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <textarea
          name="bio"
          rows={3}
          maxLength={600}
          value={v.bio}
          onChange={(e) => setV({ ...v, bio: e.target.value })}
          className={cn(field, "resize-y")}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-ink">
          City <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          name="city"
          maxLength={80}
          placeholder="Hackensack, NJ"
          value={v.city}
          onChange={(e) => setV({ ...v, city: e.target.value })}
          className={field}
        />
      </label>

      {/* ------------------------------------------------------------ accent */}
      <fieldset className="mt-5">
        <legend className="flex items-center gap-1.5 text-xs font-medium text-ink">
          <Palette className="h-3.5 w-3.5" aria-hidden />
          Accent
        </legend>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          Four colours from the Dishd palette, so your diary stays readable on
          the cream ground.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENTS.map((option) => (
            <label
              key={option.key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs",
                v.accent === option.key
                  ? "border-forest bg-forest-soft font-medium text-forest"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              <input
                type="radio"
                name="accent"
                value={option.key}
                checked={v.accent === option.key}
                onChange={() => setV({ ...v, accent: option.key })}
                className="sr-only"
              />
              <span aria-hidden className={cn("h-4 w-4 rounded-full", option.swatch)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ------------------------------------------------------------ images */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Profile picture
          </span>
          <input
            name="avatarFile"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={(e) => setNames({ ...names, avatar: e.target.files?.[0]?.name ?? "" })}
            className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-cream hover:file:bg-forest-deep"
          />
          {names.avatar && <p className="mt-1 text-xs text-forest">Attached: {names.avatar}</p>}
          <input
            name="avatarUrl"
            type="url"
            placeholder="Or paste an https:// link"
            value={v.avatarUrl}
            onChange={(e) => setV({ ...v, avatarUrl: e.target.value })}
            className={field}
          />
          {state.errors?.avatarUrl && (
            <span className="mt-1 block text-xs text-clay">{state.errors.avatarUrl}</span>
          )}
        </div>

        <div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Banner
          </span>
          <input
            name="bannerFile"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={(e) => setNames({ ...names, banner: e.target.files?.[0]?.name ?? "" })}
            className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-cream hover:file:bg-forest-deep"
          />
          {names.banner && <p className="mt-1 text-xs text-forest">Attached: {names.banner}</p>}
          <input
            name="bannerUrl"
            type="url"
            placeholder="Or paste an https:// link"
            value={v.bannerUrl}
            onChange={(e) => setV({ ...v, bannerUrl: e.target.value })}
            className={field}
          />
          {state.errors?.bannerUrl && (
            <span className="mt-1 block text-xs text-clay">{state.errors.bannerUrl}</span>
          )}
        </div>
      </div>

      {state.message && (
        <p
          role="status"
          className={cn(
            "rise mt-4 flex items-start gap-2 rounded-lg p-3 text-xs",
            state.ok
              ? "border border-forest/30 bg-forest-soft text-forest"
              : "border border-clay/30 bg-clay/10 text-clay",
          )}
        >
          {state.ok ? (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>{state.message}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 min-h-11 w-full rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save my diary"}
      </button>
    </form>
  );
}
