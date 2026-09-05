import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/market/sign-up-form";
import { SiteHeader } from "@/components/market/site-header";
import { currentProfile } from "@/lib/market/auth-actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentProfile()) redirect(next ?? "/");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-sm px-4 py-14">
        <h1 className="font-display text-3xl text-forest">Create your account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          To order pickup meals from neighbourhood cooks, or to start selling
          from your own kitchen.
        </p>

        <SignUpForm next={next ?? "/"} />

        <p className="mt-6 text-center text-xs text-ink-muted">
          Already have an account?{" "}
          <Link
            href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-forest underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </main>
    </>
  );
}
