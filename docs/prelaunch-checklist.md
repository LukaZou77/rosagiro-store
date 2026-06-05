# RosaGiro 上线前真实落地清单

这份清单用于把当前本地可运行的 RosaGiro 转成真实可售卖的线上店铺。后台 `/admin/prontidao` 是总控面板，每完成一项后把对应状态标记为 `DONE`。

## 实际操作顺序

1. 冻结当前开发基线：确认 git 干净，跑 `npx prisma validate`、`npm run typecheck`、`npm run lint`、`npm run build`，并确认 `.env.local` 不进入生产。
2. 补真实店铺资料：在 `/admin/loja` 填 CNPJ、IE、Razão social、地址、CEP、WhatsApp、邮箱、营业时间和社媒。
3. 补真实政策内容：在 `/admin/politicas` 完成隐私、条款、退换货、配送和联系内容，并做 LGPD/运营复核。
4. 商品真实化第一轮：在 `/admin/produtos/qualidade` 修 `ACTION_REQUIRED` 商品，确保 active 商品有真实图片、库存、价格、重量、描述、功效、成分、规格、validade/lote 和批发采购资料。
5. 图片存储上线准备：把真实商品图从本地 `public/uploads/products` 迁移到 S3、R2、Vercel Blob 或其他持久对象存储。
6. 物流规则确认：在 `/admin/frete` 确认安骏 D2D Pickup 表、来源、CEP 覆盖、重量段，并人工确认保险、税费、风险区、Retirada、Transportadora 和 Excursão。
7. 支付从模拟走向沙盒，再走向 live：在 `/admin/pagamentos` 配置 Mercado Pago sandbox，确认 webhook、回跳、订单变 `PAID` 和库存只扣一次；live 前隐藏正式顾客的模拟支付。
8. 生产环境部署：准备 Vercel、正式域名、生产 PostgreSQL、备份、环境变量和 `npx prisma migrate deploy`。
9. SEO / GEO / 商业入口检查：检查 metadata、canonical、OG、JSON-LD、robots、sitemap、`llms.txt`，上线预览域名跑 SEO audit，正式域名接 Google Search Console。
10. 全流程黑盒验收：手机 390/430px 和桌面 1366/1920px 跑完整顾客路径和后台路径。
11. 软上线：先开放少量 SKU 和少量真实订单，每天检查 WhatsApp、支付回调、库存、物流费用和失败 checkout。

## Go / No-Go 硬门槛

- 真实 CNPJ、地址、WhatsApp、邮箱、营业时间和政策文案已补齐。
- Active 商品没有演示 SVG，关键商品至少 3 张真实图。
- 商品价格、库存、重量、validade/lote 已人工确认。
- 图片已经迁移到持久对象存储。
- Mercado Pago sandbox webhook 全流程通过，live 配置已复核。
- 正式顾客 checkout 不显示模拟支付。
- 生产数据库有备份和回滚方案。
- 手机端完整下单流程顺畅，没有遮挡、溢出或重复主按钮。

## 上线前仍默认不做

- 不做客户账号中心、优惠券、评价系统、自动退款和真实物流面单购买。
- Google Maps 仍是可选增强；ViaCEP 保持基础地址能力。
- 安骏 D2D Pickup 第一版只做运费估算，保险、税费和风险区继续人工确认。
