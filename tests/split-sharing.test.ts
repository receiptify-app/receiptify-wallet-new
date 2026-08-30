import assert from "node:assert/strict";
import { shareOrCopySplitLink } from "../client/src/lib/split-sharing";

const payload = {
  title: "Dinner · Receiptify Split",
  text: "A secure shared-expense preview.",
  url: "https://www.receiptify.co.uk/split/share/test-token",
};

function setNavigator(value: object) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

async function main() {
  let sharedPayload: unknown;
  let copiedText = "";
  setNavigator({
    share: async (value: unknown) => {
      sharedPayload = value;
    },
    clipboard: {
      writeText: async (value: string) => {
        copiedText = value;
      },
    },
  });
  assert.equal(await shareOrCopySplitLink(payload), "shared");
  assert.deepEqual(sharedPayload, payload);
  assert.equal(copiedText, "", "successful native share must not also copy");
  console.log("ok - native share receives the contextual title, text, and secure URL");

  copiedText = "";
  setNavigator({
    share: async () => {
      throw new DOMException("Share cancelled", "AbortError");
    },
    clipboard: {
      writeText: async (value: string) => {
        copiedText = value;
      },
    },
  });
  assert.equal(await shareOrCopySplitLink(payload), "copied");
  assert.equal(copiedText, payload.url);
  console.log("ok - a cancelled native share falls back to copying the secure URL");

  copiedText = "";
  setNavigator({
    clipboard: {
      writeText: async (value: string) => {
        copiedText = value;
      },
    },
  });
  assert.equal(await shareOrCopySplitLink(payload), "copied");
  assert.equal(copiedText, payload.url);
  console.log("ok - browsers without native share copy the secure URL");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});