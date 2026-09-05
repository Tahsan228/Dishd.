import { SignInForm } from "@/components/market/sign-in-form";
import { SiteHeader } from "@/components/market/site-header";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-sm px-4 py-14">
        <h1 className="font-display text-3xl text-forest">Sign in</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          To place an order or run your kitchen.
        </p>
        <SignInForm next={next ?? "/"} />
      </main>
    </>
  );
}
