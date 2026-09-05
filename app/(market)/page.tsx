import { listActiveKitchens } from "@/lib/market/kitchens";
import { KitchenCard } from "@/components/market/kitchen-card";
import { SiteHeader } from "@/components/market/site-header";

export default async function DiscoveryPage() {
  const kitchens = await listActiveKitchens();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="rise font-display text-3xl leading-tight text-forest sm:text-4xl">
        Halal home kitchens near you
      </h1>
      <p className="mt-2 max-w-xl text-ink-muted">
        Real cooks, real kitchens, sourcing you can actually check. Pick up from
        the door.
      </p>

      {kitchens.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-surface-sunk p-8 text-center">
          <p className="text-ink-muted">
            No kitchens yet. Run the seed script once Supabase is connected.
          </p>
        </div>
      ) : (
        <div className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kitchens.map((k) => (
            <KitchenCard key={k.id} kitchen={k} />
          ))}
        </div>
      )}
      </main>
    </>
  );
}
