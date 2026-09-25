// Standalone Node tests need an empty replacement for Next.js' server-only marker.
// This hook is test-only and must never be imported by application code.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
