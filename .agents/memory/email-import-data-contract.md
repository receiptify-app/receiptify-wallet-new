---
name: Email import data contract
description: Durable rules for preserving extracted email and OCR data across the pending-receipt lifecycle.
---

Email import, OCR, reprocessing, and acceptance must use the active storage abstraction and carry extracted fields through every transition. Acceptance should remain compatible with both merchant/amount/lineItems and merchantName/total/items payloads.

**Why:** The project contains legacy Prisma-shaped email code alongside the active Drizzle storage model. Type-only repairs can compile while silently dropping merchant totals or OCR results, or querying incompatible tables.

**How to apply:** When changing email receipt processing, trace one payload from queue creation through pending storage, reprocessing, and final receipt creation. Keep OAuth credentials out of response DTOs.