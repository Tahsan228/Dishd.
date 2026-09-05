export function SocialNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 text-ink">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}
