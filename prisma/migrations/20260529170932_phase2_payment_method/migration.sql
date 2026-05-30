-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SIMULATED', 'PIX', 'CREDIT_CARD');

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'MERCADO_PAGO';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'SIMULATED';
