import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, PackageOpen } from "lucide-react";
import AppHeader from "@/components/app-header";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from 'react-i18next';
import { format } from "date-fns";

export default function ExportReceiptsPage() {
  const [, navigate] = useLocation();
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
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

  const toggleReceipt = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const withImages = receiptsList.filter(r => r.imageUrl);
    if (selected.size === withImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withImages.map(r => r.id)));
    }
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

  const downloadSelected = async () => {
    const targets = selected.size > 0
      ? receiptsList.filter(r => selected.has(r.id) && r.imageUrl)
      : receiptsList.filter(r => r.imageUrl);

    if (!targets.length) return;

    setDownloading(true);
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const r of targets) {
        try {
          const safeName = (r.merchantName || "receipt").replace(/[^\w-_]/g, "_");
          const pdfBlob = await imageToPdfBlob(r.imageUrl, safeName);
          zip.file(`${safeName}_${r.id || ""}.pdf`, pdfBlob);
        } catch (e) {
          console.warn("Skipping receipt:", r.id, e);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const label = selected.size > 0 ? `receipts_selected` : `receipts_all`;
      downloadBlob(content, `${label}_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      console.error("Failed to create ZIP:", e);
    } finally {
      setDownloading(false);
    }
  };

  const withImages = receiptsList.filter(r => r.imageUrl);
  const allSelected = withImages.length > 0 && selected.size === withImages.length;
  const someSelected = selected.size > 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader
        showBackButton={true}
        onBackClick={() => navigate('/profile')}
        title={t('exports.title')}
      />

      <div className="px-4 py-4 space-y-4">

        {/* Action bar */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('exports.exportReceipts')}</p>
                  <p className="text-xs text-gray-500">{t('exports.exportDesc')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {withImages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="text-xs"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={downloadSelected}
                disabled={downloading || receiptsList.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white ml-auto"
                data-testid="button-download-all"
              >
                <PackageOpen className="h-4 w-4 mr-1.5" />
                {downloading
                  ? "Preparing…"
                  : someSelected
                    ? `Download Selected (${selected.size})`
                    : t('exports.downloadAll')}
              </Button>
            </div>

            {someSelected && (
              <p className="text-xs text-green-700 font-medium">
                {selected.size} of {withImages.length} receipt{selected.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </CardContent>
        </Card>

        {/* Receipt list */}
        <div className="space-y-2">
          {loading && (
            <p className="text-sm text-gray-500 text-center py-6">{t('exports.loading')}</p>
          )}
          {!loading && receiptsList.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">{t('exports.noReceipts')}</p>
          )}
          {!loading && receiptsList.map((r) => {
            const isSelected = selected.has(r.id);
            const hasImage = !!r.imageUrl;
            return (
              <Card
                key={r.id}
                className={`bg-white shadow-sm border transition-colors cursor-pointer ${
                  isSelected ? 'border-green-400 bg-green-50' : 'border-transparent'
                } ${!hasImage ? 'opacity-50' : ''}`}
                onClick={() => hasImage && toggleReceipt(r.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    disabled={!hasImage}
                    onCheckedChange={() => hasImage && toggleReceipt(r.id)}
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.merchantName || t('exports.unknown')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.date ? format(new Date(r.date), 'MMM d, yyyy • h:mm a') : ''}
                      {!hasImage && ' • No image'}
                    </p>
                  </div>
                  <Button
                    onClick={e => { e.stopPropagation(); downloadReceipt(r); }}
                    size="sm"
                    variant="ghost"
                    disabled={!hasImage}
                    className="flex-shrink-0 text-gray-500"
                    data-testid={`button-download-${r.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
