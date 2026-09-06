export default function MarketLoading() {
  return <main aria-busy="true" aria-label="Loading Dishd" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
    <p className="text-sm font-medium text-forest" role="status">Finding something good nearby…</p>
    <div className="mt-5 h-36 rounded-3xl bg-forest-soft" />
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-64 rounded-2xl border border-line bg-surface" />)}</div>
  </main>;
}
