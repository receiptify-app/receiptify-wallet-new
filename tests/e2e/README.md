# Manual receipt browser test

The manual receipt regression test uses the real Firebase email/password flow.
Set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` to a pre-created Firebase account
whose email is already verified, then run:

```sh
npm run test:e2e
```

The test intentionally skips when those variables are absent so local
development does not require credentials. It fails with a verification-page
assertion if the configured account is not verified. Never commit the account
password or a saved browser session.