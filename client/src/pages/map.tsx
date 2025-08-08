import { useQuery } from "@tanstack/react-query";
import ReceiptMap from "@/components/receipt-map";
import type { Receipt } from "@shared/schema";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";

export default function MapPage() {
  const [, navigate] = useLocation();
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <AppHeader 
          showBackButton={true}
          onBackClick={() => navigate('/')}
          title="Purchase Map"
        />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
        title="Purchase Map"
      />
      <div className="p-6">
        <ReceiptMap receipts={receipts} />
      </div>
    </div>
  );
}