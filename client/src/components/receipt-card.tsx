import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { Split, Eye, Star } from "lucide-react";
import type { Receipt, ReceiptItem } from "@shared/schema";

interface ReceiptCardProps {
  receipt: Receipt & { items?: ReceiptItem[] };
}

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  const items = receipt.items || [];

  const getMerchantInfo = (merchantName: string) => {
    const name = merchantName.toLowerCase();
    if (name.includes('tesco')) return { logo: 'T', color: '#00539C', loyaltyIcon: 'C' };
    if (name.includes('waitrose')) return { logo: 'W', color: '#2C5F41', loyaltyIcon: 'W' };
    if (name.includes('shell')) return { logo: '⛽', color: '#DC143C', loyaltyIcon: 'G' };
    if (name.includes('sainsbury')) return { logo: 'S', color: '#FF8200', loyaltyIcon: 'N' };
    if (name.includes('argos')) return { logo: 'A', color: '#DC143C', loyaltyIcon: 'A' };
    if (name.includes('boots')) return { logo: 'B', color: '#0054A6', loyaltyIcon: 'B' };
    return { logo: merchantName.charAt(0), color: '#6B7280', loyaltyIcon: null };
  };

  const merchantInfo = getMerchantInfo(receipt.merchantName);
  const visibleItems = items.slice(0, 3);
  const remainingItems = items.length - 3;

  return (
    <Card className="hover:shadow-md transition-shadow border border-gray-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: merchantInfo.color }}
            >
              {merchantInfo.logo}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{receipt.merchantName}</h3>
              {receipt.location && (
                <p className="text-sm text-gray-500">{receipt.location}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-gray-900">
              ${parseFloat(receipt.total).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(receipt.date).toLocaleDateString('en-UK')}
            </div>
          </div>
        </div>

        {visibleItems.length > 0 && (
          <>
            <Separator className="border-dashed my-3" />
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate">
                    {item.quantity && parseInt(item.quantity) > 1 ? `${item.quantity}x ` : ''}{item.name}
                  </span>
                  <span className="font-medium">${parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}
              {remainingItems > 0 && (
                <div className="text-xs text-gray-400">
                  + {remainingItems} more item{remainingItems > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            {merchantInfo.loyaltyIcon ? (
              <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{merchantInfo.loyaltyIcon}</span>
              </div>
            ) : (
              <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <Star className="w-3 h-3 text-white" />
              </div>
            )}
            <span className="text-xs text-gray-600">
              Saved {receipt.ecoPoints} eco point{receipt.ecoPoints !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex space-x-2">
            <Link href={`/receipt/${receipt.id}`}>
              <Button size="sm" variant="outline" className="text-xs px-3">
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
            </Link>
          </div>
        </div>

        {receipt.category && (
          <div className="mt-3">
            <Badge variant="secondary" className="text-xs">
              {receipt.category}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
