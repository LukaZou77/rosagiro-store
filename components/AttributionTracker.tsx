"use client";

import { useEffect } from "react";
import { captureAttributionFromLocation } from "@/lib/commerce-analytics";

export function AttributionTracker() {
  useEffect(() => {
    captureAttributionFromLocation();
    window.addEventListener("rosagiro:consent-change", captureAttributionFromLocation);
    return () => window.removeEventListener("rosagiro:consent-change", captureAttributionFromLocation);
  }, []);

  return null;
}
