import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, QrCode, Camera, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QrScanner from 'qr-scanner';

interface RealQrScannerProps {
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function RealQrScanner({ onClose, onScan }: RealQrScannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (qrData: string) => {
      return await apiRequest('POST', '/api/receipts/qr', { qrData });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Receipt Created",
        description: `Successfully processed receipt from ${data.merchantName || "merchant"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/eco-metrics'] });
      onScan("qr-receipt-data");
      onClose();
      // Navigate to receipts page to show the scanned receipt
      window.location.href = '/receipts';
    },
    onError: (error: any) => {
      console.error('QR scan error:', error);
      
      // Handle specific error types
      if (error.message?.includes('Square QR code detected')) {
        toast({
          title: "Square QR Code Detected",
          description: "Square QR codes don't contain receipt data. Please enter receipt details manually using 'Add Receipt'.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "QR Scan Failed", 
          description: "QR code doesn't contain receipt data. Try scanning a different QR code or enter details manually.",
          variant: "destructive",
        });
      }
      
      // Reset scanner for next attempt
      setIsScanning(false);
      if (qrScanner) {
        qrScanner.start().catch(console.error);
      }
    }
  });

  // Initialize QR scanner with real camera scanning
  useEffect(() => {
    if (videoRef.current && !qrScanner) {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR Code detected:', result.data);
          setIsScanning(true);
          scanner.stop();
          scanMutation.mutate(result.data);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment'
        }
      );
      
      setQrScanner(scanner);
      
      // Start scanning immediately
      scanner.start().catch((error) => {
        console.error('Error starting QR scanner:', error);
        toast({
          title: "Camera Error",
          description: "Failed to access camera. Please check permissions.",
          variant: "destructive",
        });
      });
    }

    // Cleanup function
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  // Handle cleanup when component unmounts or closes
  const handleClose = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-11/12 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Scan QR Code</h3>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="relative mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 bg-black rounded-lg object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* QR Code Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
              <QrCode className="w-12 h-12 text-white opacity-50" />
            </div>
          </div>

          {/* Scanning indicator */}
          {(isScanning || scanMutation.isPending) && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white text-center">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                <p>Processing QR Code...</p>
              </div>
            </div>
          )}
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Point your camera at a receipt QR code with transaction data. Not all QR codes contain receipt information.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">QR Code Tips:</p>
            <p className="text-blue-700 dark:text-blue-300">• Look for QR codes on printed receipts</p>
            <p className="text-blue-700 dark:text-blue-300">• Square payment links won't work - use 'Add Receipt' instead</p>
            <p className="text-blue-700 dark:text-blue-300">• Make sure QR code is clear and well-lit</p>
          </div>
          
          <Button 
            onClick={() => {
              handleClose();
              window.location.href = '/receipts?add=true';
            }}
            variant="outline"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Receipt Manually Instead
          </Button>
        </div>
      </div>
    </div>
  );
}