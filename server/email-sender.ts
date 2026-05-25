// Lightweight email dispatch. Uses Brevo (formerly Sendinblue) when BREVO_API_KEY is set,
// otherwise logs the payload so local development still works.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = process.env.EMAIL_FROM || "Receiptify <no-reply@receiptify.co.uk>";
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.log(
      `[email] BREVO_API_KEY not set — would have sent to ${message.to}: ${message.subject}`,
    );
    return { sent: false, reason: "BREVO_API_KEY not configured" };
  }

  // Parse "Name <email>" or plain email for the from field
  const fromMatch = from.match(/^(.+)<(.+)>$/);
  const fromObj = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: from.trim() };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: fromObj,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html ?? message.text.replace(/\n/g, "<br>"),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as any)?.message || `HTTP ${res.status}`;
      console.error("[email] Brevo error:", detail);
      return { sent: false, reason: detail };
    }

    return { sent: true };
  } catch (err: any) {
    console.error("[email] Brevo error:", err?.message || "Unknown error");
    return { sent: false, reason: err?.message || "Unknown email error" };
  }
}
