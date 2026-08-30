export type SplitSharePayload = {
  title: string;
  text: string;
  url: string;
};

export type SplitShareOutcome = "shared" | "copied";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copying is not available in this browser");
}

export async function shareOrCopySplitLink(payload: SplitSharePayload): Promise<SplitShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch {
      // A cancelled or failed share sheet still leaves the user with a useful
      // result instead of silently discarding the newly generated secure link.
    }
  }
  await copyText(payload.url);
  return "copied";
}

export async function copySplitLink(url: string) {
  await copyText(url);
}