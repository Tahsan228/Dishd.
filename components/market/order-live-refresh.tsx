"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function OrderLiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 8000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [active, router]);
  return null;
}
