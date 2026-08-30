---
name: Split share privacy
description: Privacy and lifecycle rules for public Split invitations and entity previews.
---

Treat every public Split URL as a narrowly scoped bearer capability. A public preview may show only the minimum context needed to recognize the invitation, bill, receipt, or payment request. It must never expose member identities, folder descriptions or activity, receipt images or line items, or authenticated API access. Entity previews must be time-limited and revocable; unavailable links must fail without confirming private details.

**Why:** Social previews and messaging links are routinely fetched by logged-out crawlers and may be forwarded beyond the intended recipient. A useful share card must not become a back door into the shared workspace.

**How to apply:** Use a verified application origin rather than request headers, opaque tokens, privacy-safe server-rendered metadata and branded imagery, and explicit owner controls for active links. Keep invitation acceptance behind authentication.