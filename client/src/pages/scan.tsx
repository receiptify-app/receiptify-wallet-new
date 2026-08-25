import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Edit, Camera, Upload, Loader2 } from "lucide-react";
import ManualReceiptForm from "@/components/manual-receipt-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import AppHeader from "@/components/app-header";

export default function Scan() {
  const [showManualForm, setShowManualForm] = useState(false);
  const [activeSource, setActiveSource] = useState<'camera' | 'gallery' | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('Starting upload for', file.name, file.size);
      
      const formData = new FormData();
      formData.append('receipt', file);
      
      // Get current location if available
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        formData.append('latitude', position.coords.latitude.toString());
        formData.append('longitude', position.coords.longitude.toString());
      } catch (error) {
        console.log('Location not available:', error);
      }
      
      // Get auth token for the request
      const { auth } = await import('@/lib/firebase');
      const headers: Record<string, string> = {};
      
      if (auth?.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            console.log("Auth token attached to upload");
          }
        } catch (e) {
          console.warn('Failed to get auth token:', e);
        }
      } else {
        console.log("No authenticated user for upload");
      }
      
      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      
      const body = await response.json().catch(() => ({}));
      console.log('/api/receipts/upload status:', response.status, body);
      
      if (!response.ok) {
        const err: any = new Error(body?.error || 'Upload failed');
        err.status = response.status;
        throw err;
      }
      return body;
    },
    onSuccess: () => {
      toast({
        title: t('scan.uploadSuccess'),
        description: t('scan.uploadSuccessDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/eco-metrics'] });
    },
    onError: (error: any) => {
      const msg = String(error?.message || error?.response?.data?.error || '');
      const status = error?.status || error?.response?.status;
      
      if (status === 400 || /does not appear to contain a receipt/i.test(msg) || /not a receipt/i.test(msg)) {
        toast({
          title: t('scan.imageRejected'),
          description: t('scan.imageRejectedDesc'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('scan.uploadError'),
          description: t('scan.uploadErrorDesc'),
          variant: "destructive",
        });
      }
    },
    onSettled: () => setActiveSource(null),
  });

  const handleCameraUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActiveSource('camera');
      toast({ title: t('scan.processing'), description: "Extracting receipt details, please wait…" });
      uploadMutation.mutate(file);
    }
    event.target.value = '';
  };

  const handleGalleryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActiveSource('gallery');
      toast({ title: t('scan.processing'), description: "Extracting receipt details, please wait…" });
      uploadMutation.mutate(file);
    }
    event.target.value = '';
  };

  return (
    <div className="receiptify-page pb-24">
      <AppHeader visualSystem />
      <main className="receiptify-content">
        <div className="receiptify-hero receiptify-scan-hero receiptify-fade-in">
          <div>
            <p className="receiptify-eyebrow">Receipt capture</p>
            <h1>{t('scan.addReceipt')}<em>.</em></h1>
            <p className="receiptify-subtitle">{t('scan.addReceiptDesc')}</p>
          </div>
        </div>

      {/* Scan Options */}
      <div className="receiptify-scan-options receiptify-fade-in" style={{ animationDelay: "70ms" }}>
        {/* Camera Capture Option */}
        <Card
          className={`receiptify-scan-option ${activeSource === 'camera' ? 'is-active' : ''}`}
          data-testid="card-camera-capture"
        >
          <CardContent className="p-0">
            <label className="block w-full cursor-pointer">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraUpload}
                className="hidden"
                disabled={uploadMutation.isPending}
                data-testid="input-camera-capture"
              />
              <div className="receiptify-scan-option-row flex items-center space-x-4 py-6 px-6 hover:bg-primary/5 rounded-lg transition-colors">
                <div className="receiptify-scan-icon receiptify-scan-icon-camera w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  {activeSource === 'camera' && uploadMutation.isPending
                    ? <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    : <Camera className="w-6 h-6 text-primary" />}
                </div>
                <div className="text-left">
                  <div className="receiptify-scan-option-title font-semibold text-lg text-gray-900" data-testid="text-camera-title">
                    {activeSource === 'camera' && uploadMutation.isPending
                      ? t('scan.processing')
                      : t('scan.takePhoto')}
                  </div>
                  <div className="receiptify-scan-option-description text-sm text-gray-600">
                    {t('scan.takePhotoDesc')}
                  </div>
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Gallery Upload Option */}
        <Card
          className={`receiptify-scan-option ${activeSource === 'gallery' ? 'is-active' : ''}`}
          data-testid="card-gallery-upload"
        >
          <CardContent className="p-0">
            <label className="block w-full cursor-pointer">
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleGalleryUpload}
                className="hidden"
                disabled={uploadMutation.isPending}
                data-testid="input-gallery-upload"
              />
              <div className="receiptify-scan-option-row flex items-center space-x-4 py-6 px-6 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="receiptify-scan-icon receiptify-scan-icon-gallery w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  {activeSource === 'gallery' && uploadMutation.isPending
                    ? <Loader2 className="w-6 h-6 text-gray-700 animate-spin" />
                    : <Upload className="w-6 h-6 text-gray-700" />}
                </div>
                <div className="text-left">
                  <div className="receiptify-scan-option-title font-semibold text-lg text-gray-900" data-testid="text-upload-title">
                    {activeSource === 'gallery' && uploadMutation.isPending
                      ? t('scan.processing')
                      : t('scan.uploadFromGallery')}
                  </div>
                  <div className="receiptify-scan-option-description text-sm text-gray-600">
                    {t('scan.uploadFromGalleryDesc')}
                  </div>
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Manual Entry Option */}
        <Card className="receiptify-scan-option hover:shadow-md transition-shadow" data-testid="card-manual-entry">
          <CardContent className="p-0">
            <div
              className="receiptify-scan-option-row flex items-center space-x-4 py-6 px-6 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setShowManualForm(true)}
              data-testid="button-manual-entry"
            >
              <div className="receiptify-scan-icon receiptify-scan-icon-manual w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Edit className="w-6 h-6 text-gray-700" />
              </div>
              <div className="text-left">
                <div className="receiptify-scan-option-title font-semibold text-lg text-gray-900">{t('scan.importReceipt')}</div>
                <div className="receiptify-scan-option-description text-sm text-gray-600">{t('scan.importReceiptDesc')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Information Section */}
      <Card className="receiptify-scan-info receiptify-fade-in" style={{ animationDelay: "140ms" }}>
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">{t('scan.smartProcessing')}</h3>
              <p className="text-sm text-gray-700 mb-3">
                {t('scan.smartProcessingDesc')}
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="receiptify-feature-line">{t('scan.featureAutoExtract')}</div>
                <div className="receiptify-feature-line">{t('scan.featureSecureStorage')}</div>
                <div className="receiptify-feature-line">{t('scan.featureSimplified')}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Receipt Form */}
      <ManualReceiptForm 
        open={showManualForm} 
        onOpenChange={setShowManualForm}
      />
      </main>
    </div>
  );
}
