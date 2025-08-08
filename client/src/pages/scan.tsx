import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, QrCode, FileText } from "lucide-react";
import QrScanner from "@/components/qr-scanner";
import ScannerModal from "@/components/scanner-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Scan() {
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('receipt', file);
      const response = await apiRequest('POST', '/api/receipts/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Receipt uploaded successfully",
        description: "Your receipt has been processed and added to your collection.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to process your receipt. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary mb-2">Capture Receipt</h1>
        <p className="text-gray-600">Choose how you'd like to add your receipt</p>
      </div>

      {/* Scan Options */}
      <div className="space-y-4 mb-8">
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-6">
            <Button
              onClick={() => setShowQrScanner(true)}
              className="w-full h-auto py-6 bg-primary hover:bg-primary/90 text-left"
              disabled={showQrScanner}
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-lg">QR Code Scan</div>
                  <div className="text-sm opacity-90">Scan merchant QR code for instant receipt</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button
              onClick={() => setShowCamera(true)}
              variant="outline"
              className="w-full h-auto py-6 text-left border-2"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <div className="font-semibold text-lg text-gray-900">Take Photo</div>
                  <div className="text-sm text-gray-600">Capture receipt with camera</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadMutation.isPending}
              />
              <div className="flex items-center space-x-4 py-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <div className="font-semibold text-lg text-gray-900">
                    {uploadMutation.isPending ? "Uploading..." : "Upload from Gallery"}
                  </div>
                  <div className="text-sm text-gray-600">Choose existing photo from device</div>
                </div>
              </div>
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Information Section */}
      <Card className="bg-light-green border-accent/20">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">Privacy First</h3>
              <p className="text-sm text-gray-700 mb-3">
                All receipts are stored locally on your device. We use advanced OCR to extract receipt data while keeping your information private.
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <div>✓ Support for all major UK retailers</div>
                <div>✓ Automatic categorization and eco-impact tracking</div>
                <div>✓ Works with any payment method</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Scanner Modal */}
      {showQrScanner && (
        <QrScanner
          onClose={() => setShowQrScanner(false)}
          onScan={(data) => {
            console.log("QR Code scanned:", data);
            setShowQrScanner(false);
            toast({
              title: "QR Code detected",
              description: "Processing receipt data...",
            });
          }}
        />
      )}

      {/* Camera Scanner Modal */}
      <ScannerModal open={showCamera} onOpenChange={setShowCamera} />
    </div>
  );
}
