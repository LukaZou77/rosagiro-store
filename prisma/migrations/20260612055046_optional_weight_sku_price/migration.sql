-- AlterTable
ALTER TABLE "StoreProfile" ALTER COLUMN "trustBadges" SET DEFAULT ARRAY['Atendimento por WhatsApp', 'Entrega para todo o Brasil', 'Pedido mínimo sinalizado']::TEXT[];
