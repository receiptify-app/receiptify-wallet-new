import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreVertical, MoveRight, Share2 } from "lucide-react";
import { format } from "date-fns";
import { getCategoryColor, getCategoryIcon } from "@shared/categories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/hooks/use-currency";

interface AnalyticsReceiptCardProps {
  receipt: {
    id: string;
    merchantName: string;
    total: string | number;
    date: string | Date;
    category?: string | null;
    imageUrl?: string | null;
  };
  isSelected?: boolean;
  selectionMode?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string) => void;
  onShare?: (id: string) => void;
  onClick?: (id: string) => void;
}

export default function AnalyticsReceiptCard({
  receipt,
  isSelected = false,
  selectionMode = false,
  onSelect,
  onMove,
  onShare,
  onClick
}: AnalyticsReceiptCardProps) {
  const { format: formatCurrency } = useCurrency();
  const amount = typeof receipt.total === 'string' ? parseFloat(receipt.total) : receipt.total;
  const receiptDate = new Date(receipt.date);
  const categoryColor = receipt.category ? getCategoryColor(receipt.category) : '#757575';
  const categoryIcon = receipt.category ? getCategoryIcon(receipt.category) : '📦';

  const handleCardClick = () => {
    if (selectionMode && onSelect) {
      onSelect(receipt.id);
    } else if (onClick) {
      onClick(receipt.id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(receipt.id);
    }
  };

  return (
    <Card 
      className={`bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleCardClick}
      data-testid={`card-receipt-${receipt.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Selection checkbox */}
          {selectionMode && (
            <div onClick={handleCheckboxClick}>
              <Checkbox 
                checked={isSelected}
                data-testid={`checkbox-receipt-${receipt.id}`}
              />
            </div>
          )}

          {/* Receipt thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            {receipt.imageUrl ? (
              <img 
                src={receipt.imageUrl} 
                alt={receipt.merchantName}
                className="w-full h-full object-cover"
                data-testid={`img-receipt-${receipt.id}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {categoryIcon}
              </div>
            )}
          </div>

          {/* Receipt info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate" data-testid={`text-merchant-${receipt.id}`}>
                  {receipt.merchantName}
                </h4>
                <p className="text-sm text-gray-600" data-testid={`text-date-${receipt.id}`}>
                  {format(receiptDate, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900" data-testid={`text-amount-${receipt.id}`}>
                  {formatCurrency(amount)}
                </p>
              </div>
            </div>

            {/* Category badge */}
            {receipt.category && (
              <Badge 
                className="mt-2 text-xs"
                style={{ 
                  backgroundColor: `${categoryColor}20`, 
                  color: categoryColor,
                  border: `1px solid ${categoryColor}40`
                }}
                data-testid={`badge-category-${receipt.id}`}
              >
                {categoryIcon} {receipt.category}
              </Badge>
            )}
          </div>

          {/* Actions menu */}
          {!selectionMode && (onMove || onShare) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="flex-shrink-0"
                  data-testid={`button-menu-${receipt.id}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onMove && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(receipt.id);
                    }}
                    data-testid={`menu-move-${receipt.id}`}
                  >
                    <MoveRight className="w-4 h-4 mr-2" />
                    Move to Category
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(receipt.id);
                    }}
                    data-testid={`menu-share-${receipt.id}`}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Receipt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
