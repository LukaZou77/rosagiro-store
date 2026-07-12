import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const [{ runAnalyticsRollup }, { prisma }] = await Promise.all([
  import("../lib/analytics-rollup"),
  import("../lib/db-client")
]);

async function main() {
  const apply = process.argv.includes("--apply");
  const [pageViews, productEvents, orders, paidPayments, whatsappClicks, leads] = await Promise.all([
    prisma.sitePageView.count(),
    prisma.productAnalyticsEvent.count(),
    prisma.order.count(),
    prisma.payment.count({ where: { status: "PAID" } }),
    prisma.whatsAppClickEvent.count(),
    prisma.whatsAppLead.count()
  ]);
  const source = { pageViews, productEvents, orders, paidPayments, whatsappClicks, leads };
  const target = {
    visitorDays: await prisma.analyticsVisitorDay.count(),
    whatsappSessionDays: await prisma.whatsAppSessionDay.count(),
    productMetrics: await prisma.productDailyMetric.count(),
    periodAggregates: await prisma.analyticsPeriodAggregate.count()
  };

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", source, target }, null, 2));
    return;
  }

  const result = await runAnalyticsRollup({ fullProductBackfill: true });
  console.log(JSON.stringify({ mode: "apply", source, before: target, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha no backfill de analytics.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
