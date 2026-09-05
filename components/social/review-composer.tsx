"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, ImagePlus, Link2, Star, X } from "lucide-react";
import type { DiaryLog } from "@/lib/social/data";
import { saveReview } from "@/lib/social/review-actions";
import { PHOTO_ACCEPT, type ReviewActionState } from "@/lib/social/review-validation";
import { galleryError } from "@/lib/market/upload-validation";
import { StarRating } from "./star-rating";
import { cn } from "@/lib/utils";
const field = "mt-2 min-h-11 w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-base text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";
export function ReviewComposer({ log, kitchen }: { log: DiaryLog; kitchen?: { name: string; slug: string } | null }) {
  const [state, setState] = useState<ReviewActionState>({ ok: false, message: "" });
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ rating: log.rating_10 === null ? "" : String(log.rating_10), body: log.body ?? "", photo: "", sourcing: log.sourcing_affirmed === null ? "" : log.sourcing_affirmed ? "yes" : "no", flavor: String(log.flavor_rating_10 ?? ""), value: String(log.value_rating_10 ?? ""), quality: String(log.quality_rating_10 ?? "") });
  const [keep, setKeep] = useState(() => [...new Set([...(log.photo_urls ?? []), ...(log.photo_url ? [log.photo_url] : [])])]);
  const [files, setFiles] = useState<File[]>([]);
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const problem = galleryError(files);
    if (problem || keep.length + files.length + (draft.photo ? 1 : 0) > 3) { setState({ ok: false, message: problem ?? "Choose up to three photos total." }); return; }
    form.delete("photoFiles"); files.forEach(file => form.append("photoFiles", file));
    form.set("keepPhotos", JSON.stringify(keep));
    start(async () => {
      try {
        const result = await saveReview(log.id, state, form); setState(result);
        if (result.ok) { setKeep(result.photos ?? []); setFiles([]); setDraft(current => ({ ...current, photo: "" })); router.refresh(); }
      } catch { setState({ ok: false, message: "Your review could not be sent. Your draft is still here; please try again." }); }
    });
  }
  return <section className="rise rounded-3xl border border-line bg-surface p-6 sm:p-8" aria-label="Write your review"><p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">Your meal, in your words</p><h2 className="mt-3 font-display text-3xl">How was that first bite?</h2><p className="mt-3 text-sm leading-7 text-ink-muted">Your pickup is verified. Share the flavors, the little details, and a photo worth a second helping.</p>
    <form onSubmit={submit} className="mt-7 space-y-6">
      <fieldset><legend className="text-sm font-semibold">Overall rating</legend><div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-forest-soft p-5"><StarRating rating10={draft.rating === "" ? null : Number(draft.rating)} /><strong className="tabular text-xl text-forest">{draft.rating === "" ? "—" : Number(draft.rating) / 2}<span className="ml-1 text-xs font-normal">/ 5</span></strong></div><input type="hidden" name="rating" value={draft.rating} /><input className="mt-4 w-full accent-forest" type="range" min="0" max="10" step="1" value={draft.rating || "0"} onChange={e => setDraft({ ...draft, rating: e.target.value })} aria-label="Overall star rating" aria-valuetext={draft.rating === "" ? "Choose a rating" : Number(draft.rating) / 2 + " out of 5 stars"} disabled={pending} /><p className="mt-1 text-xs text-ink-muted">Slide to rate in half-star steps.</p>{state.errors?.rating && <p className="mt-2 text-sm text-clay">{state.errors.rating}</p>}</fieldset>
      <div className="grid gap-4 sm:grid-cols-3">{[{ key: "flavor", label: "Food & flavor" }, { key: "value", label: "Value" }, { key: "quality", label: "Packaging & care" }].map(({ key, label }) => <label key={key} className="text-xs font-semibold">{label}<select name={key} value={draft[key as "flavor" | "value" | "quality"]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className={field} disabled={pending}><option value="">Optional</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i / 2} stars</option>)}</select></label>)}</div>
      <label className="block text-sm font-semibold">Tell the story<textarea name="body" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} maxLength={3000} rows={5} className={field} placeholder="The meal you’re already thinking about again…" disabled={pending} /></label>
      <div className="flex flex-wrap items-center gap-3 text-xs"><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-forest" onClick={() => setDraft({ ...draft, body: draft.body + " @" })}><AtSign className="size-4" />Mention someone</button>{kitchen && <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-forest" onClick={() => setDraft({ ...draft, body: draft.body + ` [${kitchen.name}](/k/${kitchen.slug})` })}><Link2 className="size-4" />Link this kitchen</button>}<span className="ml-auto text-ink-muted">{draft.body.length}/3,000</span></div><p className="text-xs leading-6 text-ink-muted">Use @handle to link a neighbor. Kitchen links and HTTPS links become clickable when shared. Keep pickup codes and home addresses private.</p>
      <fieldset><legend className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-4" />A few good photos</legend><p className="mt-2 text-xs leading-6 text-ink-muted">Up to 3 images · 8 MB each · 12 MB together.</p>{keep.length > 0 && <div className="mt-3 grid grid-cols-3 gap-3">{keep.map((url, i) => <div key={url} className="relative overflow-hidden rounded-xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={"Review photo " + (i + 1)} referrerPolicy="no-referrer" className="aspect-square w-full object-cover" /><button type="button" aria-label={"Remove existing photo " + (i + 1)} onClick={() => setKeep(keep.filter(item => item !== url))} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-cream text-forest"><X className="size-4" /></button></div>)}</div>}
      <input type="file" accept={PHOTO_ACCEPT} multiple disabled={pending} aria-label="Choose review photos" onChange={e => { const next = Array.from(e.target.files ?? []); const problem = galleryError(next); if (problem) { setState({ ok: false, message: problem }); e.target.value = ""; } else setFiles(next); }} className="mt-4 block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-5 file:py-3 file:text-sm file:text-cream" />
      {files.map((file, i) => <p key={file.name + i} className="mt-2 flex items-center gap-2 text-xs text-forest"><Star className="size-3" />{file.name}<button type="button" className="ml-auto min-h-8 underline" onClick={() => setFiles(files.filter((_, index) => index !== i))}>Remove</button></p>)}
      <label className="mt-4 block text-xs text-ink-muted">Or add a hosted photo<input name="photo" type="url" value={draft.photo} onChange={e => setDraft({ ...draft, photo: e.target.value })} placeholder="https://…" className={field} /></label>{state.errors?.photo && <p className="mt-2 text-sm text-clay">{state.errors.photo}</p>}</fieldset>
      <label className="block rounded-2xl bg-forest-soft p-5 text-sm font-medium leading-6 text-forest">Did the packaging and quality match the cook’s sourcing claim?<select name="sourcing" value={draft.sourcing} onChange={e => setDraft({ ...draft, sourcing: e.target.value })} required className={field} disabled={pending}><option value="" disabled>Choose an answer</option><option value="yes">Yes, it matched</option><option value="no">No, something did not match</option><option value="unsure">Not sure</option></select><span className="mt-2 block text-xs font-normal">Share what you observed. Use “Not sure” if you could not tell.</span></label>
      <p role="status" className={cn("text-sm leading-6", state.ok ? "text-forest" : "text-clay")}>{state.message}</p><button disabled={pending} className="min-h-12 w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-deep disabled:opacity-60">{pending ? "Sharing your review…" : log.rating_10 === null ? "Share your review" : "Save review changes"}</button>
    </form></section>;
}
