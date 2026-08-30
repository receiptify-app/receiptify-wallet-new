ALTER TABLE "split_payment_requests"
  ADD COLUMN IF NOT EXISTS "subfolder_id" varchar,
  ADD COLUMN IF NOT EXISTS "context" text,
  ADD COLUMN IF NOT EXISTS "message" text;