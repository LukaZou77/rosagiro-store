import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { LEGACY_GUIDE_COVER, procurementGuideCovers, withGuideCover } from "@/lib/guide-covers";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";

test("the three procurement guides have distinct existing cover assets", () => {
  const covers = procurementGuideArticles.map((article) => article.coverImage);
  assert.equal(new Set(covers).size, 3);
  for (const cover of Object.values(procurementGuideCovers)) {
    assert.ok(existsSync(path.join(process.cwd(), "public", cover.coverImage)));
    assert.ok(cover.coverImageAlt.length > 20);
  }
});

test("legacy published covers resolve consistently without changing article content", () => {
  for (const guide of procurementGuideArticles) {
    const legacy = { ...guide, coverImage: LEGACY_GUIDE_COVER, coverImageAlt: "Old shared cover" };
    const resolved = withGuideCover(legacy);
    assert.equal(resolved.coverImage, guide.coverImage);
    assert.equal(resolved.coverImageAlt, guide.coverImageAlt);
    assert.equal(resolved.body, legacy.body);
    assert.equal(legacy.coverImageAlt, "Old shared cover");
  }
});

test("custom uploads, empty covers and other guides are preserved", () => {
  const guide = procurementGuideArticles[1];
  for (const coverImage of ["/uploads/guides/custom.jpg", "", null]) {
    const article = { ...guide, coverImage };
    assert.equal(withGuideCover(article), article);
  }
  const other = { ...guide, slug: "other-guide", coverImage: LEGACY_GUIDE_COVER };
  assert.equal(withGuideCover(other), other);
});
