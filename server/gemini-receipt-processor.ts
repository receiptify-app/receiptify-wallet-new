import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";
import pRetry, { AbortError } from "p-retry";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ReceiptItem {
  name: string;
  price: string;
  quantity: number;
}

export interface ParsedReceiptData {
  merchantName: string;
  location: string;
  total: string;
  subtotal?: string;
  tax?: string;
  date?: Date;
  receiptNumber?: string;
  paymentMethod?: string;
  category?: string;
  items: ReceiptItem[];
  currency?: string;
  confidence?: number;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

const RECEIPT_EXTRACTION_PROMPT = `You are an expert receipt parser. Analyze the receipt image and extract all information in a structured format.

IMPORTANT RULES:
1. Extract the EXACT text as it appears on the receipt
2. For prices, include only the numeric value (e.g., "12.99" not "£12.99")
3. Detect the currency symbol used (£, $, €, etc.) and include it in the currency field
4. Parse the date into ISO 8601 format (YYYY-MM-DDTHH:mm:ss.000Z)
5. If you cannot find a value, use null
6. For items, extract each line item with its name, price, and quantity (default quantity to 1 if not specified)
7. Identify the merchant/store name from the top of the receipt
8. Categorize the purchase into one of: Groceries, Dining, Transport, Healthcare, Electronics, Shopping, Entertainment, Travel, Utilities, Other

Be thorough and accurate. This is a real receipt that needs precise data extraction.`;

export async function processReceiptWithGemini(imagePath: string): Promise<ParsedReceiptData | null> {
  console.log("=== Starting Gemini Receipt Processing ===");
  console.log("Image path:", imagePath);

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    
    const ext = imagePath.toLowerCase().split('.').pop();
    let mimeType = "image/jpeg";
    if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "gif") mimeType = "image/gif";

    console.log("Image size:", imageBuffer.length, "bytes, mimeType:", mimeType);

    const response = await pRetry(
      async () => {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  { text: RECEIPT_EXTRACTION_PROMPT },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  merchantName: { type: Type.STRING, description: "Store or merchant name" },
                  location: { type: Type.STRING, description: "Store address or location" },
                  total: { type: Type.STRING, description: "Total amount as numeric string" },
                  subtotal: { type: Type.STRING, description: "Subtotal before tax" },
                  tax: { type: Type.STRING, description: "Tax amount" },
                  date: { type: Type.STRING, description: "Date in ISO 8601 format" },
                  receiptNumber: { type: Type.STRING, description: "Receipt or transaction number" },
                  paymentMethod: { type: Type.STRING, description: "Payment method used (Card, Cash, etc.)" },
                  category: { type: Type.STRING, description: "Category: Groceries, Dining, Transport, Healthcare, Electronics, Shopping, Entertainment, Travel, Utilities, or Other" },
                  currency: { type: Type.STRING, description: "Currency code (GBP, USD, EUR, etc.)" },
                  isReceipt: { type: Type.BOOLEAN, description: "Whether this image is a valid receipt" },
                  confidence: { type: Type.NUMBER, description: "Confidence score 0-100" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Item name/description" },
                        price: { type: Type.STRING, description: "Item price as numeric string" },
                        quantity: { type: Type.INTEGER, description: "Quantity purchased" },
                      },
                      required: ["name", "price", "quantity"],
                    },
                  },
                },
                required: ["merchantName", "total", "items", "isReceipt"],
              },
            },
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            console.log("Rate limit hit, retrying...");
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 30000,
        factor: 2,
      }
    );

    // Handle response - could be response.text (property) or response.text() (method)
    let responseText = "";
    if (typeof response.text === 'function') {
      responseText = await (response as any).text() || "";
    } else {
      responseText = response.text || "";
    }
    
    // Also try accessing via candidates if direct text is empty
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    console.log("Gemini raw response length:", responseText.length);
    console.log("Gemini raw response preview:", responseText.substring(0, 500));

    if (!responseText) {
      console.log("Gemini returned empty response");
      throw new Error("Gemini returned empty response");
    }

    const parsed = JSON.parse(responseText);
    console.log("=== Gemini Parsed Receipt Data ===");
    console.log(JSON.stringify(parsed, null, 2));

    if (parsed.isReceipt === false) {
      console.log("Gemini determined this is NOT a receipt");
      // This is a valid determination - throw special error to indicate non-receipt
      const err = new Error("NOT_A_RECEIPT: Image does not appear to be a receipt");
      (err as any).code = "NOT_A_RECEIPT";
      throw err;
    }

    const result: ParsedReceiptData = {
      merchantName: parsed.merchantName || "Unknown Store",
      location: parsed.location || "",
      total: parsed.total || "0.00",
      subtotal: parsed.subtotal || undefined,
      tax: parsed.tax || undefined,
      date: parsed.date ? new Date(parsed.date) : undefined,
      receiptNumber: parsed.receiptNumber || undefined,
      paymentMethod: parsed.paymentMethod || "Unknown",
      category: parsed.category || "Shopping",
      currency: parsed.currency || "GBP",
      confidence: parsed.confidence || 85,
      items: (parsed.items || []).map((item: any) => ({
        name: item.name || "Unknown Item",
        price: item.price || "0.00",
        quantity: item.quantity || 1,
      })),
    };

    console.log("=== Final Processed Receipt ===");
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error: any) {
    console.error("Gemini receipt processing error:", error);
    // Re-throw to allow fallback to Tesseract OCR
    // Preserve the error code if it's a NOT_A_RECEIPT determination
    if (error?.code === "NOT_A_RECEIPT") {
      throw error;
    }
    throw new Error(`Gemini processing failed: ${error?.message || error}`);
  }
}

export async function validateReceiptImage(imagePath: string): Promise<{ isReceipt: boolean; reason?: string }> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    
    const ext = imagePath.toLowerCase().split('.').pop();
    let mimeType = "image/jpeg";
    if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Is this image a receipt or invoice? Reply with only 'yes' or 'no' followed by a brief reason." },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
    });

    const text = (response.text || "").toLowerCase();
    const isReceipt = text.startsWith("yes");
    
    return {
      isReceipt,
      reason: response.text || undefined,
    };
  } catch (error) {
    console.error("Validation error:", error);
    return { isReceipt: true };
  }
}
