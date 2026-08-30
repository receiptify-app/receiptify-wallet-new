---
name: Split balance ledger
description: Durable accounting and concurrency rules for Split totals, settlement, and member removal.
---

Count each receipt, manual expense, and bill exactly once as source spending. Derive shared debt separately: a known payer's own share is personal, while declined or removed-member shares are not allocated debt. Settlement may only move existing debt between pending and paid; it must not change source spend, allocation, or personal remainder.

**Why:** Treating assignments as spend omitted personal remainder and duplicated source facts. Separately, uncoordinated settlement and removal could erase paid history or revive declined shares.

**How to apply:** Use the canonical balance calculator for every list/detail summary and round GBP values in pence. Member status transitions must share one member lock, then re-read and compare the expected financial state before writing. Source edits/deletes must lock their allocation rows and re-check paid status inside the transaction. Never trust only a route-level preflight read.