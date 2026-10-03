import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  currentQuickPurchaseSummaryState,
  isCurrentQuickPurchaseRequest,
  shouldFetchQuickPurchaseSummary,
  wrappedDialogFocusTarget,
  type QuickPurchaseSummaryState
} from "./QuickPurchaseDrawerState";

const drawerSource = readFileSync(new URL("./QuickPurchaseDrawer.tsx", import.meta.url), "utf8");

test("quick purchase event and FAB share the cycle-aware open handler", () => {
  assert.match(drawerSource, /subscribeQuickPurchaseOpen\(\(\) => openDrawer\(\)\)/);
  assert.match(drawerSource, /onClick=\{\(event\) => openDrawer\(event\.currentTarget\)\}/);
  assert.doesNotMatch(drawerSource, /quick-purchase-fab[^>]+onClick=\{\(\) => setOpen\(true\)\}/s);
});

test("quick purchase summary fetches only while the drawer is open with cart lines", () => {
  assert.equal(shouldFetchQuickPurchaseSummary({ drawerOpen: false, cartLength: 2 }), false);
  assert.equal(shouldFetchQuickPurchaseSummary({ drawerOpen: true, cartLength: 0 }), false);
  assert.equal(shouldFetchQuickPurchaseSummary({ drawerOpen: true, cartLength: 2 }), true);
});

test("dialog focus wrapping handles boundaries and focus outside the drawer", () => {
  const elements = ["close", "checkout", "cart"];
  assert.equal(
    wrappedDialogFocusTarget({ elements, activeElement: "cart", activeInside: true, shiftKey: false }),
    "close"
  );
  assert.equal(
    wrappedDialogFocusTarget({ elements, activeElement: "close", activeInside: true, shiftKey: true }),
    "cart"
  );
  assert.equal(
    wrappedDialogFocusTarget({ elements, activeElement: null, activeInside: false, shiftKey: false }),
    "close"
  );
  assert.equal(
    wrappedDialogFocusTarget({ elements, activeElement: "checkout", activeInside: true, shiftKey: false }),
    null
  );
});

test("quick purchase request guard rejects aborted and superseded responses", () => {
  assert.equal(isCurrentQuickPurchaseRequest({ requestId: 4, activeRequestId: 4, aborted: false }), true);
  assert.equal(isCurrentQuickPurchaseRequest({ requestId: 4, activeRequestId: 5, aborted: false }), false);
  assert.equal(isCurrentQuickPurchaseRequest({ requestId: 4, activeRequestId: 4, aborted: true }), false);
});

test("quick purchase summary ignores stale cart keys and request cycles", () => {
  const state = {
    cartKey: '[{"slug":"novo","quantity":12}]',
    requestCycle: 3,
    status: "error",
    message: "old request"
  } satisfies QuickPurchaseSummaryState;

  assert.equal(currentQuickPurchaseSummaryState(state, state.cartKey, 2), null);
  assert.equal(currentQuickPurchaseSummaryState(state, '[{"slug":"outro","quantity":12}]', 3), null);
  assert.equal(currentQuickPurchaseSummaryState(state, state.cartKey, 3), state);
});
