CREATE TABLE "SiteInfoPage" (
  "id" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "eyebrow" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sections" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteInfoPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteInfoPage_pageKey_key" ON "SiteInfoPage"("pageKey");
CREATE UNIQUE INDEX "SiteInfoPage_slug_key" ON "SiteInfoPage"("slug");
CREATE UNIQUE INDEX "SiteInfoPage_href_key" ON "SiteInfoPage"("href");
CREATE INDEX "SiteInfoPage_active_slug_idx" ON "SiteInfoPage"("active", "slug");
