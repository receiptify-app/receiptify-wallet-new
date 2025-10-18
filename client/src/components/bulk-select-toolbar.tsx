import { Button } from "@/components/ui/button";
import { X, MoveRight } from "lucide-react";

interface BulkSelectToolbarProps {
  selectedCount: number;
  onMove: () => void;
  onCancel: () => void;
}

export default function BulkSelectToolbar({
  selectedCount,
  onMove,
  onCancel
}: BulkSelectToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="fixed bottom-20 left-0 right-0 bg-primary text-white py-4 px-6 shadow-lg z-50"
      data-testid="toolbar-bulk-select"
    >
      <div className="max-w-sm mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onCancel}
            data-testid="button-cancel-selection"
          >
            <X className="w-5 h-5" />
          </Button>
          <span className="font-semibold" data-testid="text-selected-count">
            {selectedCount} selected
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onMove}
          className="bg-white text-primary hover:bg-gray-100"
          data-testid="button-bulk-move"
        >
          <MoveRight className="w-4 h-4 mr-2" />
          Move to Category
        </Button>
      </div>
    </div>
  );
}
