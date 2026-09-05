import Link from "next/link";

export function SocialHeader() {
  return <header className="no-print border-b border-line bg-cream"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4"><Link href="/" className="font-display text-3xl text-forest">dishd<span className="text-brass">.</span></Link><Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-forest hover:underline">Find a home kitchen</Link></div></header>;
}
