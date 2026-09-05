"use client";

import { useSyncExternalStore } from "react";

const KEY = "dishd:saved-kitchens:v1";
let memory = "[]";
let storageUnavailable = false;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dishd:saved", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dishd:saved", callback);
  };
}
function snapshot() {
  if (storageUnavailable) return memory;
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    storageUnavailable = true;
    return memory;
  }
}
function parse(value: string): string[] {
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function useSavedKitchens() {
  const saved = parse(useSyncExternalStore(subscribe, snapshot, () => "[]"));
  function toggle(id: string) {
    const current = parse(snapshot());
    memory = JSON.stringify(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    try {
      localStorage.setItem(KEY, memory);
    } catch {
      /* Keep the current tab usable if storage is unavailable. */
      storageUnavailable = true;
    }
    window.dispatchEvent(new Event("dishd:saved"));
  }
  return { saved, toggle };
}
