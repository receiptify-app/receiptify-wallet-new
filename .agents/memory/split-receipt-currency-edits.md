---
name: Split receipt currency edits
description: The raw-currency versus GBP contract for correcting shared receipt items.
---

Receipt item corrections must edit the amount in the receipt's original currency. Convert that raw value to GBP only for Split display and allocation calculations; never write a converted GBP value back into the source item.

**Why:** Foreign-currency receipts snapshot an exchange rate. Round-tripping a converted display value into the raw source applies the rate again and corrupts later balances.

**How to apply:** Label editable values with the receipt currency, keep the raw value available at the API boundary, and derive the GBP amount from it for canonical Split calculations.