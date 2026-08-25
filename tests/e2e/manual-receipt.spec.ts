import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;

type GeolocationBehavior = "denied" | "never-settles";

function installGeolocationStub(page: Page, behavior: GeolocationBehavior) {
  return page.addInitScript((mode: GeolocationBehavior) => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(
          success: PositionCallback,
          error?: PositionErrorCallback,
        ) {
          if (mode === "denied") {
            error?.({
              code: 1,
              message: "User denied geolocation",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
            return;
          }

          // Intentionally leave both callbacks untouched. The application must
          // use its own timeout and continue saving the receipt.
          void success;
        },
      },
    });
  }, behavior);
}

async function signInAsVerifiedTestUser(
  page: Page,
  geolocationBehavior: GeolocationBehavior,
) {
  test.skip(
    !testEmail || !testPassword,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to a verified Firebase test account.",
  );

  await installGeolocationStub(page, geolocationBehavior);
  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail!);
  await page.getByLabel("Password").fill(testPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("button-manual-entry")).toBeVisible();
}

async function openManualReceiptDialog(page: Page) {
  await page.getByTestId("button-manual-entry").click();
  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute(
    "aria-describedby",
    "manual-receipt-description",
  );
  await expect(page.locator("#manual-receipt-description")).toBeVisible();

  return dialog;
}

async function fillReceipt(page: Page, dialog: Locator, merchant: string) {
  await dialog.getByLabel("Merchant Name").fill(merchant);
  await dialog.locator("#date").fill("2026-08-25");
  await dialog.locator("#totalAmount").fill("12.34");

  const paymentMethod = dialog
    .locator('label[for="paymentMethod"]')
    .locator("..")
    .getByRole("combobox");
  await paymentMethod.click();
  await page.getByRole("option", { name: "Credit Card", exact: true }).click();
}

async function saveAndWaitForResponse(page: Page, dialog: Locator) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/receipts") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save Receipt" }).click();
  return responsePromise;
}

async function expectReceiptInMyReceipts(page: Page, merchant: string) {
  await page.goto("/receipts");
  await page.getByRole("button", { name: "Toggle search" }).click();
  await page
    .getByPlaceholder("Search merchant, category, amount...")
    .fill(merchant);
  await expect(page.locator(`[title="${merchant}"]`)).toBeVisible();
}

test.describe("manual receipt save resilience", () => {
  test("saves when geolocation is denied and shows the receipt in My Receipts", async ({
    page,
  }) => {
    await signInAsVerifiedTestUser(page, "denied");
    const dialog = await openManualReceiptDialog(page);
    const merchant = `E2E Denied ${Date.now()}`;
    await fillReceipt(page, dialog, merchant);

    const response = await saveAndWaitForResponse(page, dialog);
    expect(response.status()).toBe(201);
    await expect(dialog).not.toBeVisible();

    await expectReceiptInMyReceipts(page, merchant);
  });

  test("saves when geolocation never calls back", async ({ page }) => {
    await signInAsVerifiedTestUser(page, "never-settles");
    const dialog = await openManualReceiptDialog(page);
    const merchant = `E2E Timeout ${Date.now()}`;
    await fillReceipt(page, dialog, merchant);

    const startedAt = Date.now();
    const response = await saveAndWaitForResponse(page, dialog);
    expect(response.status()).toBe(201);
    expect(Date.now() - startedAt).toBeLessThan(12_000);
    await expect(dialog).not.toBeVisible();

    await expectReceiptInMyReceipts(page, merchant);
  });

  test("restores Save Receipt and displays the API error after a failed save", async ({
    page,
  }) => {
    await signInAsVerifiedTestUser(page, "denied");
    const dialog = await openManualReceiptDialog(page);
    const merchant = `E2E Failure ${Date.now()}`;
    await fillReceipt(page, dialog, merchant);

    await page.route("**/api/receipts", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Receipt API unavailable" }),
      });
    });

    const saveButton = dialog.getByRole("button", { name: "Save Receipt" });
    await saveButton.click();
    await expect(page.getByText("Receipt API unavailable", { exact: true })).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await expect(dialog).toBeVisible();
  });
});