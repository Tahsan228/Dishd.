import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Dishd home">
          <Image
            src="/logos/PaleBackgroundGreenText.png"
            alt="Dishd"
            width={104}
            height={30}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <Link
          href="/cook"
          className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream transition hover:bg-forest-deep"
        >
          Start selling
        </Link>
      </div>
    </header>
  );
}
