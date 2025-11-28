import { initAdmin, admin } from './firebase-admin';
initAdmin();

const firestore = admin.firestore();

function parseNumber(v: any) {
  if (v == null) return null;
  const s = String(v).replace(/[^0-9.-]+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function saveParsedReceiptToDb(parsed: any, userId?: string) {
  const docRef = firestore.collection('receipts').doc();
  await docRef.set({
    userId: userId || 'unknown',
    merchantName: parsed.merchantName || null,
    location: parsed.location || null,
    total: parseNumber(parsed.total),
    subtotal: parseNumber(parsed.subtotal),
    tax: parseNumber(parsed.tax),
    currency: parsed.currency ?? 'GBP',
    date: parsed.date ? new Date(parsed.date) : new Date(),
    receiptNumber: parsed.receiptNumber ?? null,
    paymentMethod: parsed.paymentMethod ?? null,
    category: parsed.category ?? null,
    items: parsed.items ?? [],
    rawData: parsed,
    imageUrl: parsed.imageUrl ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: docRef.id };
}

export async function getReceiptsForUser(userId?: string, limit = 200) {
  let q = firestore.collection('receipts').orderBy('createdAt', 'desc').limit(limit);
  if (userId) q = firestore.collection('receipts').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(limit);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}