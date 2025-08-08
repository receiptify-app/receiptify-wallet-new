import { MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Receipt } from "@shared/schema";

interface ReceiptMapProps {
  receipts: Receipt[];
}

export default function ReceiptMap({ receipts }: ReceiptMapProps) {
  const receiptsWithLocation = receipts.filter(r => r.latitude && r.longitude);

  const handleOpenInMaps = (receipt: Receipt) => {
    if (receipt.latitude && receipt.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${receipt.latitude},${receipt.longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <MapPin className="w-5 h-5" />
            Purchase Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mock map display */}
          <div className="h-64 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg relative overflow-hidden border-2 border-dashed border-gray-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <MapPin className="w-12 h-12 mx-auto mb-2 text-primary" />
                <p className="font-medium">Interactive Map View</p>
                <p className="text-sm">Showing {receiptsWithLocation.length} geo-tagged receipts</p>
              </div>
            </div>
            
            {/* Mock map pins */}
            <div className="absolute top-4 left-6 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
            <div className="absolute bottom-8 right-8 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
            <div className="absolute top-1/2 left-1/3 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {receiptsWithLocation.map((receipt) => (
          <Card key={receipt.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{receipt.merchantName}</div>
                    <div className="text-sm text-gray-600">{receipt.location}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(receipt.date).toLocaleDateString()} • £{receipt.total}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenInMaps(receipt)}
                  className="flex items-center gap-1"
                >
                  <Navigation className="w-4 h-4" />
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {receiptsWithLocation.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="font-medium text-gray-900 mb-2">No Geo-Tagged Receipts</h3>
            <p className="text-sm text-gray-600">
              Start scanning receipts to see your purchase locations on the map
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}