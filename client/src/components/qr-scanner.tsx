import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, QrCode } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface QrScannerProps {
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QrScanner({ onClose, onScan }: QrScannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scanMutation = useMutation({
    mutationFn: async () => {
      // Simulate QR scan processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock receipt data from QR scan
      const mockReceiptData = {
        merchantName: "Waitrose & Partners",
        location: "Canary Wharf, London",
        total: "18.95",
        date: new Date().toISOString(),
        category: "Groceries",
        paymentMethod: "Card",
        items: [
          { name: "Essential Oranges 1kg", price: "2.50", category: "Fruit" },
          { name: "Duchy Organic Milk 1L", price: "1.85", category: "Dairy" },
          { name: "Essential Pasta 500g", price: "1.20", category: "Pantry" },
          { name: "Salmon Fillet 200g", price: "4.50", category: "Fish" },
          { name: "Baby Spinach 200g", price: "2.25", category: "Vegetables" },
          { name: "Sourdough Loaf", price: "3.50", category: "Bakery" },
          { name: "Greek Yogurt 500g", price: "3.15", category: "Dairy" },
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
        description: "Receipt imported from Waitrose & Partners.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/eco-metrics'] });
      onScan("waitrose-receipt-data");
      onClose();
    },
    onError: () => {
      toast({
        title: "Scan failed",
        description: "Failed to process QR code. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    // Auto-trigger scan after a short delay to simulate QR detection
    const timer = setTimeout(() => {
      scanMutation.mutate();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex justify-between items-center p-6 text-white">
        <h2 className="text-xl font-semibold">Scan QR Code</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20"
          disabled={scanMutation.isPending}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Camera viewfinder mockup */}
      <div className="flex-1 relative flex items-center justify-center">
        <div className="w-64 h-64 border-2 border-white border-dashed rounded-2xl flex items-center justify-center relative">
          <div className="text-center text-white">
            <QrCode className="w-16 h-16 mb-4 mx-auto opacity-50 animate-pulse" />
            <p className="text-sm">
              {scanMutation.isPending ? "Processing QR code..." : "Position QR code within frame"}
            </p>
            {scanMutation.isPending && (
              <div className="mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            )}
          </div>
          
          {/* Scanning corners animation */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent animate-pulse"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent animate-pulse"></div>
          
          {/* Scanning line animation */}
          {!scanMutation.isPending && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent animate-ping"></div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="text-center text-white/80 text-sm">
          <p>Point your camera at the QR code on your receipt</p>
          <p className="text-xs mt-1">Supported: Tesco, Waitrose, Sainsbury's, Shell, and more</p>
        </div>
        
        <Button 
          className="w-full bg-white text-black hover:bg-gray-200" 
          onClick={onClose}
          disabled={scanMutation.isPending}
        >
          Cancel Scan
        </Button>
      </div>
    </div>
  );
}
