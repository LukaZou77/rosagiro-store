ALTER TABLE "StoreProfile"
  ADD COLUMN "pixPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pixAccountType" TEXT NOT NULL DEFAULT 'TEMPORARY_PERSONAL',
  ADD COLUMN "pixRecipientName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pixRecipientDocument" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pixKeyType" TEXT NOT NULL DEFAULT 'RANDOM',
  ADD COLUMN "pixKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pixBankName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pixInstructions" TEXT NOT NULL DEFAULT 'Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.';
