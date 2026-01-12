import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle, Clock, Package, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";
import type { Warranty } from "@shared/schema";
import { useCurrency } from "@/hooks/use-currency";

function getWarrantyStatus(endDate: Date) {
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining < 0) {
    return { 
      status: "expired", 
      color: "text-red-600", 
      bg: "bg-red-100", 
      icon: AlertTriangle,
      label: `Expired ${Math.abs(daysRemaining)} days ago`
    };
  } else if (daysRemaining <= 30) {
    return { 
      status: "expiring", 
      color: "text-yellow-600", 
      bg: "bg-yellow-100", 
      icon: Clock,
      label: `Expires in ${daysRemaining} days`
    };
  }
  return { 
    status: "active", 
    color: "text-green-600", 
    bg: "bg-green-100", 
    icon: CheckCircle,
    label: `${daysRemaining} days remaining`
  };
}

export default function Warranties() {
  const [, navigate] = useLocation();
  const { format: formatCurrency } = useCurrency();

  const { data: warranties = [], isLoading } = useQuery<Warranty[]>({
    queryKey: ["/api/warranties"],
  });

  const activeWarranties = warranties.filter(w => {
    const endDate = new Date(w.warrantyEndDate);
    return endDate.getTime() > Date.now();
  });

  const expiringWarranties = warranties.filter(w => {
    const endDate = new Date(w.warrantyEndDate);
    const daysRemaining = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 && daysRemaining <= 30;
  });

  const expiredWarranties = warranties.filter(w => {
    const endDate = new Date(w.warrantyEndDate);
    return endDate.getTime() <= Date.now();
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
        title="Warranty Tracker"
      />

      <div className="px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700">{activeWarranties.length}</p>
              <p className="text-xs text-green-600">Active</p>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-700">{expiringWarranties.length}</p>
              <p className="text-xs text-yellow-600">Expiring Soon</p>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700">{expiredWarranties.length}</p>
              <p className="text-xs text-red-600">Expired</p>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Soon Section */}
        {expiringWarranties.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Expiring Soon
            </h2>
            {expiringWarranties.map((warranty) => (
              <WarrantyCard key={warranty.id} warranty={warranty} onClick={() => navigate(`/receipts/${warranty.receiptId}`)} />
            ))}
          </div>
        )}

        {/* Active Warranties Section */}
        {activeWarranties.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Active Warranties
            </h2>
            {activeWarranties.filter(w => !expiringWarranties.includes(w)).map((warranty) => (
              <WarrantyCard key={warranty.id} warranty={warranty} onClick={() => navigate(`/receipts/${warranty.receiptId}`)} />
            ))}
          </div>
        )}

        {/* Expired Warranties Section */}
        {expiredWarranties.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Expired Warranties
            </h2>
            {expiredWarranties.map((warranty) => (
              <WarrantyCard key={warranty.id} warranty={warranty} onClick={() => navigate(`/receipts/${warranty.receiptId}`)} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {warranties.length === 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Warranties Yet</h3>
              <p className="text-gray-600 mb-4">
                Add warranty information to your receipts to track product warranties and get expiry reminders.
              </p>
              <Button onClick={() => navigate('/receipts')} variant="outline">
                View Receipts
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WarrantyCard({ warranty, onClick }: { warranty: Warranty; onClick: () => void }) {
  const endDate = new Date(warranty.warrantyEndDate);
  const startDate = new Date(warranty.warrantyStartDate);
  const statusInfo = getWarrantyStatus(endDate);
  const StatusIcon = statusInfo.icon;

  return (
    <Card 
      className="bg-white border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${statusInfo.bg} rounded-full flex items-center justify-center`}>
            <Package className={`w-6 h-6 ${statusInfo.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{warranty.productName}</h3>
            <p className="text-sm text-gray-600">{warranty.retailerName}</p>
            <div className={`flex items-center gap-1 mt-1 ${statusInfo.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{statusInfo.label}</span>
            </div>
          </div>
          
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Start</span>
            <p className="font-medium text-gray-900">{startDate.toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">End</span>
            <p className="font-medium text-gray-900">{endDate.toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
