"use client";

import { useEffect } from "react";
import { captureAttributionFromLocation } from "@/lib/commerce-analytics";

export function AttributionTracker() {
  useEffect(() => {
    captureAttributionFromLocation();
  }, []);

  return null;
}
