export interface OcrResult {
  text: string;
  confidence: number;
  error?: string;
}

export function ocrExtract(filePath: string): Promise<OcrResult>;