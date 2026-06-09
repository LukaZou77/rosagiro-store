ALTER TABLE "StoreProfile"
  ALTER COLUMN "shippingNote" SET DEFAULT 'Enviamos para todo o Brasil com cotação por CEP. Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.';

UPDATE "StoreProfile"
SET "shippingNote" = 'Enviamos para todo o Brasil com cotação por CEP. Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.'
WHERE "shippingNote" IN (
  'Anjun D2D Pickup, transportadora e excursão serão confirmadas antes do envio.',
  'Anjun D2D Pickup, transportadora e excursao serao confirmadas antes do envio.',
  'Transportadora, entrega padrao e excursao serao confirmadas antes do envio.',
  'Transportadora, entrega padrão e excursão serão confirmadas antes do envio.'
);

UPDATE "StoreProfile"
SET "trustBadges" = ARRAY['Atendimento por WhatsApp', 'Entrega para todo o Brasil', 'Pedido mínimo sinalizado']
WHERE "trustBadges" = ARRAY['Loja em preparação', 'Atendimento por WhatsApp', 'Pedido mínimo sinalizado']
   OR "trustBadges" = ARRAY['Loja em preparacao', 'Atendimento por WhatsApp', 'Pedido minimo sinalizado'];

UPDATE "SiteInfoPage"
SET
  "description" = 'Informações iniciais sobre entrega nacional e modalidades de frete para pedidos no Brasil.',
  "sections" = '[
    {
      "title": "Cotação por CEP",
      "body": "Enviamos para todo o Brasil com cotação por CEP no checkout. Retirada local, transportadora e excursão continuam como opções de consulta pelo WhatsApp."
    },
    {
      "title": "Confirmação de cobertura",
      "body": "Algumas regiões podem exigir confirmação de cobertura, prazo, seguro, imposto ou taxa adicional pelo WhatsApp antes do envio."
    }
  ]'::jsonb
WHERE "pageKey" = 'shipping'
  AND "description" IN (
    'Informacoes iniciais sobre modalidades de entrega para pedidos no Brasil.',
    'Informações iniciais sobre modalidades de entrega para pedidos no Brasil.'
  )
  AND "sections"::text LIKE '%A loja trabalha com estimativa de frete por CEP no checkout%';
