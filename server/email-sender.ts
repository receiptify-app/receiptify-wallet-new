// Lightweight email dispatch. Uses SendGrid when SENDGRID_API_KEY is set,
// otherwise logs the payload so local development still works.

let sgMailPromise: Promise<any> | null = null;
async function getSgMail() {
  if (!sgMailPromise) {
    sgMailPromise = import("@sendgrid/mail").then((mod) => {
      const client = (mod as any).default ?? mod;
      if (process.env.SENDGRID_API_KEY) {
        client.setApiKey(process.env.SENDGRID_API_KEY);
      }
      return client;
    });
  }
  return sgMailPromise;
}

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
  if (!process.env.SENDGRID_API_KEY) {
    console.log(
      `[email] SENDGRID_API_KEY not set — would have sent to ${message.to}: ${message.subject}`,
    );
    return { sent: false, reason: "SENDGRID_API_KEY not configured" };
  }
  try {
    const sgMail = await getSgMail();
    await sgMail.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? message.text.replace(/\n/g, "<br>"),
    });
    return { sent: true };
  } catch (err: any) {
    const detail = err?.response?.body?.errors?.[0]?.message || err?.message || "Unknown email error";
    console.error("[email] SendGrid error:", detail);
    return { sent: false, reason: detail };
  }
}
