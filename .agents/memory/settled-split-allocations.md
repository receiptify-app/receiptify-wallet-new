---
name: Settled Split allocations
description: The durability rule for editing or deleting paid allocations in Receiptify Split.
---

Paid receipt, expense, and bill allocations must not be changed, removed, detached, or moved as an accidental side effect of editing the workspace. Require the owner to explicitly mark the relevant share unpaid before the destructive change.

**Why:** Settlement is durable financial history. Silently replacing or deleting a paid row can erase acknowledged debt and corrupt folder balances.

**How to apply:** Any future Split mutation that can replace or remove allocations must preserve unchanged paid rows and reject affected paid rows until they are deliberately unsettled.