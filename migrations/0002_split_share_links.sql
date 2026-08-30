CREATE TABLE IF NOT EXISTS "split_share_links" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" varchar NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" varchar NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "created_by" varchar NOT NULL,
  "revoked_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "split_share_links_token_hash_idx"
  ON "split_share_links" ("token_hash");
CREATE INDEX IF NOT EXISTS "split_share_links_entity_idx"
  ON "split_share_links" ("folder_id", "entity_type", "entity_id");