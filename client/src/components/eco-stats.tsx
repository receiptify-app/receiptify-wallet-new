import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf } from "lucide-react";
import type { EcoMetrics } from "@shared/schema";

export default function EcoStats() {
  const { data: ecoMetrics, isLoading } = useQuery<EcoMetrics>({
    queryKey: ["/api/eco-metrics"],
  });

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="flex justify-between items-center mb-2">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-6 w-8 bg-gray-200 rounded mx-auto mb-1"></div>
                  <div className="h-3 w-12 bg-gray-200 rounded mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-primary">This Month's Impact</span>
          <Leaf className="w-5 h-5 text-accent animate-eco-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-accent">
              {ecoMetrics?.papersSaved || 0}
            </div>
            <div className="text-xs text-gray-600">Papers Saved</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-accent">
              {parseFloat(ecoMetrics?.co2Reduced || "0").toFixed(1)}kg
            </div>
            <div className="text-xs text-gray-600">CO₂ Reduced</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-accent">
              {parseFloat(ecoMetrics?.treesEquivalent || "0").toFixed(1)}
            </div>
            <div className="text-xs text-gray-600">Trees Saved</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
