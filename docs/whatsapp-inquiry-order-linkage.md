# WhatsApp inquiry and order linkage

## Data flow

1. An opted-in WhatsApp link activation creates one random analytics `eventId`.
2. The browser appends `Referência do atendimento: RGWA-<eventId>` to the draft before WhatsApp navigation and sends the same `eventId` plus reference to the existing internal click endpoint.
3. A click remains analytics only. It does not create a lead or count as an inquiry.
4. After a real customer conversation, an admin creates or edits a lead and enters the exact reference supplied by the customer.
5. The server accepts only an existing exact reference and snapshots its click time, path, and UTM fields on the lead. Those snapshots remain if raw click retention later deletes the click event.
6. An admin may attach or replace an order number. The order must exist and its normalized Brazilian phone must equal the lead phone.
7. `WON` requires a linked order whose payment has `status=PAID` and a non-null `paidAt`. Changing an order status manually is not sufficient.

There is intentionally no fuzzy reference matching, click-to-lead auto-conversion, order auto-linking, payment override, or WhatsApp message submission.

## Privacy

- DNT or GPC stops reference creation, link mutation, internal click recording, GA4 lead tracking, and Google Ads conversion tracking.
- Google analytics records `whatsapp_click`, never `generate_lead`, and receives only a destination classification such as `wa.me/direct`; phone numbers, query parameters, draft text, CPF values, and query tokens are not included.
- Internal click tracking ignores `/admin` and `/api`. It stores `/pedido/[orderNumber]` and `/pagamento-simulado/[orderNumber]` instead of real order identifiers.
- The inquiry reference is random and contains no customer data.

## Deployment order

1. Generate the Prisma client and run validation/tests without applying the database migration.
2. Before deploying code that reads the new fields, apply migration `20260926113000_whatsapp_inquiry_order_linkage` to production Neon.
3. Deploy the application only after the migration succeeds.

The migration only adds nullable columns, unique indexes, and a nullable click-event foreign key with `ON DELETE SET NULL`.
