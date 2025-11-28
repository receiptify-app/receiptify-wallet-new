import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { downloadBufferFromStorage } from '../firebase-storage';
import { OCRProcessor } from '../ocr-processor'; // existing processor

const router = express.Router();

router.post('/api/receipts/process', async (req, res) => {
  try {
    const { path: storagePath } = req.body;
    if (!storagePath) return res.status(400).json({ error: 'path is required' });

    // download object buffer from Firebase Storage
    let buf: Buffer | null = null;
    try {
      buf = await downloadBufferFromStorage(storagePath);
      console.log('Downloaded bytes from storage:', buf?.length);
    } catch (dlErr) {
      console.error('Error downloading from storage helper:', dlErr);
      return res.status(500).json({ error: 'Failed to download storage object', details: String(dlErr) });
    }

    try {
      // write buffer to a temporary file and process by filepath because OCRProcessor expects a string path
      const tmpPath = path.join(os.tmpdir(), `ocr_${Date.now()}_${Math.random().toString(36).slice(2,8)}.png`);
      await fs.promises.writeFile(tmpPath, buf);

      try {
        const parsed = await OCRProcessor.processReceiptImage(tmpPath);

        // cleanup temp file
        await fs.promises.unlink(tmpPath).catch(()=>{});

        // persist parsed result to DB and return ID/metadata (if helper exists)
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { saveParsedReceiptToDb } = require('../receipt-save');
          if (typeof saveParsedReceiptToDb === 'function') {
            const saved = await saveParsedReceiptToDb(parsed, (req as any).user?.id);
            console.log('Saved receipt id:', saved.id ?? saved);
            return res.json({ ok: true, parsed, saved });
          }
        } catch (saveErr) {
          console.error('Error saving parsed receipt:', saveErr);
        }

        return res.json({ ok: true, parsed });
      } catch (err: any) {
        // cleanup temp file on error
        await fs.promises.unlink(tmpPath).catch(()=>{});

        // If OCRProcessor throws a NOT_A_RECEIPT error, return 4xx so caller can decide (and optionally delete the uploaded object)
        if (err && err.code === 'NOT_A_RECEIPT') {
          return res.status(400).json({ error: 'Uploaded file is not a receipt' });
        }
        throw err;
      }
    } catch (err: any) {
      // outer catch will handle logging/response
      throw err;
    }
  } catch (err: any) {
    console.error('Process-upload error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

export default router;