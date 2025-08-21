import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X, QrCode, Edit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ScannerModal({ open, onOpenChange }: ScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
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
      
      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Receipt captured successfully",
        description: "Your receipt has been processed and added to your collection.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/eco-metrics'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Capture failed",
        description: "Failed to process your receipt. Please try again.",
        variant: "destructive",
      });
    }
  });

  const mockScanMutation = useMutation({
    mutationFn: async () => {
      // Simulate QR scan with mock data
      const mockReceiptData = {
        merchantName: "Tesco Express",
        location: "High Street, London",
        total: "15.67",
        date: new Date().toISOString(),
        category: "Groceries",
        paymentMethod: "Card",
        items: [
          { name: "Organic Bananas", price: "1.50", category: "Fruit" },
          { name: "Whole Milk 2L", price: "1.45", category: "Dairy" },
          { name: "Sourdough Bread", price: "2.80", category: "Bakery" },
          { name: "Free Range Eggs x12", price: "3.20", category: "Dairy" },
          { name: "Broccoli", price: "1.95", category: "Vegetables" },
          { name: "Chicken Breast 500g", price: "4.77", category: "Meat" },
        ]
      };

      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockReceiptData),
      });
      
      if (!response.ok) throw new Error('Failed to create receipt');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "QR code scanned successfully",
        description: "Receipt imported from Tesco Express.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/eco-metrics'] });
      onOpenChange(false);
      setIsScanning(false);
    },
    onError: () => {
      toast({
        title: "Scan failed",
        description: "Failed to process QR code. Please try again.",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleQRScan = () => {
    setIsScanning(true);
    // Simulate scanning delay
    setTimeout(() => {
      mockScanMutation.mutate();
    }, 2000);
  };

  if (isScanning) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-black/90 border-0 text-white">
          <div className="flex flex-col h-[500px]">
            <div className="flex justify-between items-center p-6 pb-4">
              <DialogTitle className="text-xl font-semibold text-white">
                Scan QR Code
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsScanning(false);
                  onOpenChange(false);
                }}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Camera viewfinder mockup */}
            <div className="flex-1 relative flex items-center justify-center px-6">
              <div className="w-64 h-64 border-2 border-white border-dashed rounded-2xl flex items-center justify-center relative">
                <div className="text-center text-white">
                  <QrCode className="w-16 h-16 mb-4 mx-auto opacity-50 animate-pulse" />
                  <p className="text-sm">Position QR code within frame</p>
                  {mockScanMutation.isPending && (
                    <div className="mt-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                      <p className="text-xs mt-2">Processing...</p>
                    </div>
                  )}
                </div>
                
                {/* Scanning corners animation */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent animate-pulse"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent animate-pulse"></div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <Button 
                className="w-full bg-white text-black hover:bg-gray-200" 
                onClick={() => setIsScanning(false)}
                disabled={mockScanMutation.isPending}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo Instead
              </Button>
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadMutation.isPending || mockScanMutation.isPending}
                />
                <Button 
                  variant="outline" 
                  className="w-full border-white text-white hover:bg-white/20"
                  disabled={uploadMutation.isPending || mockScanMutation.isPending}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Gallery
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Capture Receipt
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* QR Scan Option */}
          <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-0">
              <Button
                onClick={handleQRScan}
                className="w-full h-auto py-6 bg-primary hover:bg-primary/90 text-left rounded-lg"
                disabled={mockScanMutation.isPending}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-primary-foreground">
                      {mockScanMutation.isPending ? "Scanning..." : "QR Code Scan"}
                    </div>
                    <div className="text-sm text-primary-foreground/90">
                      Scan merchant QR code for instant receipt
                    </div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Camera Option */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <label className="block w-full cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadMutation.isPending}
                />
                <div className="flex items-center space-x-4 py-6 px-4 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-gray-900">
                      {uploadMutation.isPending ? "Processing..." : "Take Photo"}
                    </div>
                    <div className="text-sm text-gray-600">
                      Capture receipt with camera
                    </div>
                  </div>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Upload Option */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <label className="block w-full cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadMutation.isPending}
                />
                <div className="flex items-center space-x-4 py-6 px-4 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-gray-900">
                      Upload from Gallery
                    </div>
                    <div className="text-sm text-gray-600">
                      Choose existing photo from device
                    </div>
                  </div>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Manual Entry Option */}
          <Card className="hover:shadow-md transition-shadow border-2 border-green-200">
            <CardContent className="p-0">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  // This will be handled by the parent component
                  window.dispatchEvent(new CustomEvent('openManualReceiptForm'));
                }}
                variant="outline"
                className="w-full h-auto py-6 text-left border-0 hover:bg-green-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Edit className="w-6 h-6 text-green-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-gray-900">
                      Enter Details Manually
                    </div>
                    <div className="text-sm text-gray-600">
                      Type receipt information by hand
                    </div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Information */}
        <Card className="bg-light-green border-accent/20 mt-4">
          <CardContent className="p-4">
            <div className="text-sm text-gray-700">
              <div className="font-medium text-primary mb-2">Privacy First</div>
              <div className="space-y-1 text-xs">
                <div>✓ All data stored locally on your device</div>
                <div>✓ Automatic eco-impact tracking</div>
                <div>✓ Works with all payment methods</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
