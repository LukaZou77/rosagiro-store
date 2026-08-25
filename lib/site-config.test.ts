import assert from "node:assert/strict";
import test from "node:test";
import {
  siteConfig,
  wholesaleMinimumOrderCents,
  wholesaleMinimumOrderLabel,
  wholesaleMinimumOrderShortLabel
} from "./site-config";

test("keeps all customer-facing minimum-order copy on the canonical value", () => {
  assert.equal(wholesaleMinimumOrderCents, 50000);
  assert.equal(wholesaleMinimumOrderLabel, "R$ 500,00");
  assert.equal(wholesaleMinimumOrderShortLabel, "R$ 500");
  assert.equal(siteConfig.wholesale.minimumOrderCents, wholesaleMinimumOrderCents);

  const customerFacingConfig = JSON.stringify({
    description: siteConfig.description,
    wholesale: siteConfig.wholesale,
    hero: siteConfig.hero,
    homePromotions: siteConfig.homePromotions,
    promotionsPage: siteConfig.promotionsPage,
    productConversion: siteConfig.productConversion
  });

  assert.match(customerFacingConfig, /R\$ 500/);
  assert.doesNotMatch(customerFacingConfig, /R\$\s*300(?:,00)?/i);
});
