import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import AppHeader from "@/components/app-header";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from 'react-i18next';

export default function ExportReceiptsPage() {
  const [, navigate] = useLocation();
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiRequest("GET", "/api/receipts");
        const data = await res.json();
        if (mounted) setReceiptsList(data || []);
      } catch (e) {
        console.error("Failed to load receipts for export:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadReceipt = async (r: any) => {
    if (!r?.imageUrl) return;
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const safeName = (r.merchantName || "receipt").replace(/[^\w-_]/g, "_");
      const pdfBlob = await imageToPdfBlob(r.imageUrl, safeName);
      downloadBlob(pdfBlob, `${safeName}_${r.id || ""}.pdf`);
    } catch (e) {
      console.error("Download receipt failed:", e);
    }
  };

  const downloadAllAsZip = async () => {
    if (!receiptsList.length) return;
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const r of receiptsList) {
        if (!r.imageUrl) continue;
        try {
          const safeName = (r.merchantName || "receipt").replace(/[^\w-_]/g, "_");
          const pdfBlob = await imageToPdfBlob(r.imageUrl, safeName);
          zip.file(`${safeName}_${r.id || ""}.pdf`, pdfBlob);
        } catch (e) {
          console.warn("Skipping receipt in ZIP due to error:", r.id, e);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, `receipts_${new Date().toISOString().slice(0,10)}.zip`);
    } catch (e) {
      console.error("Failed to create ZIP:", e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/profile')}
        title={t('exports.title')}
      />

      <div className="px-6 py-6 space-y-6">
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Download className="w-6 h-6 text-gray-700" />
              <div>
                <div className="text-lg font-medium text-gray-900">{t('exports.exportReceipts')}</div>
                <div className="text-sm text-gray-500">{t('exports.exportDesc')}</div>
              </div>
            </div>
            <Button onClick={downloadAllAsZip} size="sm" data-testid="button-download-all">{t('exports.downloadAll')}</Button>
          </CardContent>
        </Card>

        <div>
          <div className="space-y-2">
            {loading && <div className="text-sm text-gray-600">{t('exports.loading')}</div>}
            {!loading && receiptsList.length === 0 && <div className="text-sm text-gray-600">{t('exports.noReceipts')}</div>}
            {!loading && receiptsList.map((r) => (
              <Card key={r.id} className="bg-white shadow-sm border-0">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="text-sm text-gray-800">
                    <div className="font-medium">{r.merchantName || t('exports.unknown')}</div>
                    <div className="text-xs text-gray-500">{r.date ? new Date(r.date).toLocaleString() : ''}</div>
                  </div>
                  <div>
                    <Button onClick={() => downloadReceipt(r)} size="sm" variant="ghost" data-testid={`button-download-${r.id}`}>{t('exports.download')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
