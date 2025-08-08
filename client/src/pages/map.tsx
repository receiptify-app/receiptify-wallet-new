import { useQuery } from "@tanstack/react-query";
import ReceiptMap from "@/components/receipt-map";
import type { Receipt } from "@shared/schema";

export default function MapPage() {
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="p-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">Purchase Map</h1>
        <p className="text-gray-600">
          View all your receipts on an interactive map to see exactly where each purchase happened
        </p>
      </div>
      
      <ReceiptMap receipts={receipts} />
    </div>
  );
}