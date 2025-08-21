import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapPin, Download, Utensils } from "lucide-react";
import type { ReceiptDesign } from "@shared/schema";

interface ReceiptData {
  id: string;
  merchantName: string;
  date: string;
  location: string;
  items: Array<{ name: string; price: number; category?: string }>;
  total: number;
  paymentMethod: string;
  cashback: number;
  category: string;
  ecoPoints: number;
}

interface CustomizableReceiptProps {
  receiptData: ReceiptData;
  design?: ReceiptDesign;
  onSplit?: () => void;
  includeInAnalytics?: boolean;
  onAnalyticsToggle?: (checked: boolean) => void;
}

const colorSchemeClasses = {
  green: {
    primary: "bg-green-600",
    secondary: "bg-green-100",
    text: "text-green-600",
    accent: "border-green-600 bg-green-50",
  },
  blue: {
    primary: "bg-blue-600",
    secondary: "bg-blue-100", 
    text: "text-blue-600",
    accent: "border-blue-600 bg-blue-50",
  },
  purple: {
    primary: "bg-purple-600",
    secondary: "bg-purple-100",
    text: "text-purple-600", 
    accent: "border-purple-600 bg-purple-50",
  },
  red: {
    primary: "bg-red-600",
    secondary: "bg-red-100",
    text: "text-red-600",
    accent: "border-red-600 bg-red-50",
  },
  orange: {
    primary: "bg-orange-600",
    secondary: "bg-orange-100",
    text: "text-orange-600",
    accent: "border-orange-600 bg-orange-50",
  },
  dark: {
    primary: "bg-gray-900",
    secondary: "bg-gray-100",
    text: "text-gray-900",
    accent: "border-gray-900 bg-gray-50",
  },
};

const fontStyleClasses = {
  modern: "font-sans",
  classic: "font-serif",
  monospace: "font-mono",
  handwritten: "font-handwriting",
};

const fontSizeClasses = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

export function CustomizableReceipt({
  receiptData,
  design,
  onSplit,
  includeInAnalytics = true,
  onAnalyticsToggle,
}: CustomizableReceiptProps) {
  // Use default design if none provided
  const activeDesign = design || {
    colorScheme: "green",
    backgroundStyle: "clean",
    layoutStyle: "modern",
    showMap: true,
    showEcoPoints: true,
    showAnalyticsToggle: true,
    fontStyle: "modern",
    fontSize: "medium",
    itemDisplayStyle: "list",
    showItemCategories: false,
    showItemImages: false,
    groupSimilarItems: false,
    showMerchantLogo: true,
    customWatermark: "",
  };

  const colors = colorSchemeClasses[activeDesign.colorScheme as keyof typeof colorSchemeClasses];
  const fontClass = fontStyleClasses[activeDesign.fontStyle as keyof typeof fontStyleClasses];
  const sizeClass = fontSizeClasses[activeDesign.fontSize as keyof typeof fontSizeClasses];

  const getBackgroundClass = () => {
    switch (activeDesign.backgroundStyle) {
      case "gradient":
        return `bg-gradient-to-br from-white to-${activeDesign.colorScheme}-50`;
      case "pattern":
        return "bg-white bg-opacity-95 bg-pattern";
      case "textured":
        return "bg-white bg-texture";
      default:
        return "bg-white";
    }
  };

  const getLayoutPadding = () => {
    switch (activeDesign.layoutStyle) {
      case "classic":
        return "px-4 py-3";
      case "minimal":
        return "px-6 py-2";
      case "detailed":
        return "px-8 py-6";
      default:
        return "px-6 py-4";
    }
  };

  const groupedItems = activeDesign.groupSimilarItems
    ? receiptData.items.reduce((acc, item) => {
        const existing = acc.find(i => i.name === item.name);
        if (existing) {
          existing.quantity += 1;
          existing.price += item.price;
        } else {
          acc.push({ ...item, quantity: 1 });
        }
        return acc;
      }, [] as Array<{ name: string; price: number; category?: string; quantity: number }>)
    : receiptData.items.map(item => ({ ...item, quantity: 1 }));

  return (
    <div className={`max-w-md mx-auto ${fontClass} ${sizeClass}`}>
      <div className={`${getBackgroundClass()} shadow-lg rounded-lg overflow-hidden`}>
        {/* Custom watermark */}
        {activeDesign.customWatermark && (
          <div className="text-center py-2 text-xs text-gray-400 bg-gray-50">
            {activeDesign.customWatermark}
          </div>
        )}

        <div className={getLayoutPadding()}>
          {/* Store Info */}
          <div className="text-center mb-4">
            {activeDesign.showMerchantLogo && (
              <div className={`w-12 h-12 ${colors.primary} rounded-full flex items-center justify-center mx-auto mb-2`}>
                <span className="text-white font-bold text-lg">
                  {receiptData.merchantName.charAt(0)}
                </span>
              </div>
            )}
            
            <h1 className={`text-2xl font-bold text-gray-900 ${activeDesign.layoutStyle === 'minimal' ? 'mb-1' : 'mb-2'}`}>
              {receiptData.merchantName}
            </h1>
            
            {activeDesign.layoutStyle !== 'minimal' && (
              <p className="text-gray-600">
                {receiptData.date} • {receiptData.location}
              </p>
            )}
          </div>

          {/* Map Card */}
          {activeDesign.showMap && (
            <Card className={`${colors.secondary} shadow-sm border-0 mb-4`}>
              <CardContent className="p-4">
                <div className="relative h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <div className="relative z-10">
                    <div className={`w-8 h-8 ${colors.primary} rounded-full flex items-center justify-center shadow-lg`}>
                      <MapPin className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items List */}
          <Card className="bg-white shadow-sm border-0 mb-4">
            <CardContent className="p-6 space-y-3">
              {activeDesign.itemDisplayStyle === "grid" ? (
                <div className="grid grid-cols-2 gap-3">
                  {groupedItems.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      {activeDesign.showItemCategories && item.category && (
                        <span className="text-xs text-gray-500 block mb-1">{item.category}</span>
                      )}
                      <div className="font-medium text-sm">{item.name}</div>
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                      )}
                      <div className="font-semibold">£{item.price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : activeDesign.itemDisplayStyle === "compact" ? (
                <div className="space-y-1">
                  {groupedItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="truncate">
                        {item.quantity > 1 && `${item.quantity}x `}{item.name}
                      </span>
                      <span className="font-semibold ml-2">£{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                // Default list view
                <div className="space-y-3">
                  {groupedItems.map((item, index) => (
                    <div key={index}>
                      {activeDesign.showItemCategories && item.category && (
                        <span className="text-xs text-gray-500 block mb-1">{item.category}</span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 font-medium">
                          {item.quantity > 1 && `${item.quantity}x `}{item.name}
                        </span>
                        <span className="text-gray-900 font-semibold">
                          £{item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>£{receiptData.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          {activeDesign.layoutStyle !== 'minimal' && (
            <Card className="bg-white shadow-sm border-0 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-900 text-white px-2 py-1 rounded text-sm font-bold">
                      VISA
                    </div>
                    <span className="text-gray-900 font-medium">Debit</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cashback */}
          {activeDesign.layoutStyle === 'detailed' && receiptData.cashback > 0 && (
            <Card className="bg-white shadow-sm border-0 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-medium">Cashback</span>
                  <span className="text-gray-900 font-semibold">£{receiptData.cashback.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category & Eco Points */}
          {activeDesign.showEcoPoints && (
            <Card className="bg-white shadow-sm border-0 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${colors.secondary} rounded-full flex items-center justify-center`}>
                      <Utensils className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <span className="text-gray-900 font-medium">{receiptData.category}</span>
                  </div>
                  <span className="text-sm text-gray-600">+{receiptData.ecoPoints} Eco Points Saved</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analytics Toggle */}
          {activeDesign.showAnalyticsToggle && (
            <Card className="bg-white shadow-sm border-0 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-medium">Include in Monthly Analytics</span>
                  <Switch 
                    checked={includeInAnalytics}
                    onCheckedChange={onAnalyticsToggle}
                    className={`data-[state=checked]:${colors.primary}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Split Receipt Button */}
          {onSplit && (
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-4">
                <Button 
                  className={`w-full ${colors.primary} hover:opacity-90 text-white py-4 text-lg font-semibold rounded-2xl`}
                  size="lg"
                  onClick={onSplit}
                >
                  Split Receipt
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}