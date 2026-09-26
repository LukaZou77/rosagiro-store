# Revisão editorial dos guias de compra - 26/09/2026

## Escopo da revisão

Revisão editorial assistida por IA (Codex), solicitada por Luka, dos três rascunhos de guias de compra. Esta revisão não foi realizada por uma pessoa e não deve ser atribuída a Luka.

Fontes conferidas no checkout `64f029b`:

- `lib/site-config.ts`: pedido mínimo de R$ 500,00, carrinho multimarcas, venda por embalagem fechada, retirada na LA BELLA e endereço confirmado.
- `lib/freight-policy.ts`: o site recebe somente o pagamento dos produtos; o frete é calculado pelo atendimento com peso e dimensões reais, aprovado pelo cliente e cobrado separadamente.
- `components/CartClient.tsx` e `app/admin/frete/page.tsx`: comunicação efetivamente exibida na interface sobre pagamento apenas dos produtos, cotação pela equipe e cobrança separada após aprovação.
- `components/PickupLocation.tsx`, `app/informacoes-da-loja/page.tsx`, `app/guias/[slug]/page.tsx` e `app/admin/guias/page.tsx`: endereço de retirada renderizado e campos editoriais usados para autor, revisão, data e fontes.

## Resultado por guia

### Como montar um pedido misto no atacado

- Confirmado o mínimo de R$ 500,00 em produtos.
- Explicitado que categorias, itens e marcas podem ser combinados no mesmo carrinho.
- Esclarecido que o frete não compõe o mínimo nem o total pago no site.
- Mantida a obrigação de respeitar a embalagem fechada indicada para cada item.

### Caixa fechada, caixa master e mínimo por item

- Removida qualquer leitura de quantidade universal por caixa.
- Diferenciadas embalagem de venda e caixa master sem presumir unidades.
- Limitada a menção de caixa master aos casos informados no produto ou confirmados pelo atendimento.
- Mantida a composição original de cores e variações em embalagem fechada.

### Frete separado e retirada no atacado

- Confirmado que o site cobra somente os produtos.
- Confirmado que a equipe cota o frete e o cobra separadamente somente após aprovação.
- Incluída a retirada agendada na LA BELLA, Rua Paula Sousa, 529, Box A01, São Paulo - SP.
- Reforçada a necessidade de confirmação pelo WhatsApp antes do deslocamento.

## Evidência editorial e publicação

Nos metadados públicos, os três guias usam `RosaGiro` como organização responsável editorial, data `26/09/2026` e uma nota factual sobre a configuração conferida. Esse rótulo representa responsabilidade editorial da organização, não uma pessoa nem uma alegação de revisão humana. O registro interno deste documento continua informando com transparência que a revisão efetiva foi assistida por IA (Codex). Os campos obrigatórios de autor, responsável pela revisão editorial, data e fontes continuam exigidos para qualquer guia ativo.

O script `scripts/publish-procurement-guides.ts` não cria linhas e não aceita conteúdo aproximado. O dry-run exige exatamente os três rascunhos existentes com os hashes antigos esperados. O apply repete a validação dentro de uma transação serializável, usa `id` e `updatedAt` como proteção contra edição concorrente, atualiza somente esses três slugs e faz leitura final de status e hash. Uma segunda execução aceita apenas os três guias já publicados com os hashes finais, sem reescrever as linhas.

### Verificação read-only da linha de base em produção

Em 26/09/2026, uma consulta somente leitura comparou todos os campos usados pelo hash das três linhas de produção com os rascunhos autorizados no commit `6304fb7`. Título, slug, resumo, capa, descrição da capa, corpo, autor, revisor, data de revisão, fontes, estado ativo e ordem apresentaram zero diferenças. As três linhas continuavam inativas, sem `publishedAt`, e cada `updatedAt` era igual ao respectivo `createdAt`.

Hashes confirmados tanto no Git quanto na leitura de produção:

- `como-montar-pedido-misto-atacado`: `914db86a44067f07e2890acf6daee0b931c17d55a38cb218145c1643b7357f1f`.
- `entenda-caixa-fechada-caixa-master-e-minimo-por-item`: `dec65ed4c1ced351db76dcd7aabc708f7fb97a5ce9b36a84d9ab63fab9a89f7c`.
- `como-funciona-frete-e-retirada-no-atacado`: `1ab7049f3dba83824b6d9ecac475a4e587256faf3eddcb75e87f35323300ec7b`.

Os hashes fixados anteriormente (`40f16d...`, `de5cd5...` e `503d86...`) foram calculados por um comando auxiliar que aplicava `reviewerName || null`. Isso converteu incorretamente o valor autorizado `""` em `null`. O Prisma não normalizou nem alterou as linhas: o hash oficial preserva o valor exato de cada campo, inclusive a string vazia.

Nenhuma aplicação no banco, publicação, commit, push, deploy ou verificação em navegador foi executada nesta etapa.
