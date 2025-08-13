import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, X, FlashlightIcon as Flashlight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore - QuaggaJS doesn't have proper TypeScript definitions
import Quagga from "quagga";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBarcodeDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onOpenChange, onBarcodeDetected }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startScanning = async () => {
    try {
      setError(null);
      setIsScanning(true);

      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: { ideal: "environment" }, // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start barcode detection
      startBarcodeDetection();
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please ensure you've granted camera permissions.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    setFlashlightOn(false);
    
    // Stop QuaggaJS
    Quagga.stop();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleFlashlight = async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if ('torch' in capabilities) {
        await track.applyConstraints({
          advanced: [{ torch: !flashlightOn } as any]
        });
        setFlashlightOn(!flashlightOn);
      } else {
        toast({
          title: "Flashlight not available",
          description: "Your device doesn't support flashlight control.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Flashlight error:", err);
      toast({
        title: "Flashlight error",
        description: "Unable to control flashlight.",
        variant: "destructive"
      });
    }
  };

  const startBarcodeDetection = () => {
    if (!videoRef.current) return;

    // @ts-ignore - QuaggaJS type definitions
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current,
        constraints: {
          width: 640,
          height: 480,
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: 2,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "code_39_reader",
          "code_39_vin_reader",
          "codabar_reader",
          "upc_reader",
          "upc_e_reader"
        ]
      },
      locate: true
    }, (err: any) => {
      if (err) {
        console.error("QuaggaJS initialization error:", err);
        setError("Failed to initialize barcode scanner. Please try again.");
        return;
      }
      
      console.log("QuaggaJS initialized successfully");
      Quagga.start();

      // Set up barcode detection listener
      // @ts-ignore - QuaggaJS type definitions
      Quagga.onDetected((result: any) => {
        const code = result.codeResult.code;
        console.log("Barcode detected:", code);
        
        Quagga.stop();
        stopScanning();
        onBarcodeDetected(code);
        onOpenChange(false);
        
        toast({
          title: "Barcode Detected!",
          description: `Barcode: ${code}`,
        });
      });
    });
  };

  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-red-600 font-medium mb-2">Camera Error</div>
                  <div className="text-sm text-red-700 mb-4">{error}</div>
                  <Button onClick={startScanning} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Camera View */}
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/12' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                
                {/* Scanning Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-green-500 rounded-lg relative">
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-500 animate-pulse"></div>
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                        Position barcode in the frame
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="absolute top-4 right-4 space-y-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleFlashlight}
                    className={flashlightOn ? "bg-yellow-500 text-black" : ""}
                  >
                    <Flashlight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-blue-700 font-medium mb-2">
                      {isScanning ? "Scanning..." : "Position your camera"}
                    </div>
                    <div className="text-sm text-blue-600">
                      Point your camera at the barcode on your receipt. The barcode will be detected automatically.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}