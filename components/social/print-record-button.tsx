"use client";

import { Printer } from "lucide-react";

export function PrintRecordButton() {
  return <button type="button" onClick={() => window.print()} className="no-print inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-cream hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><Printer className="size-4" aria-hidden="true" />Print / Save as PDF</button>;
}
