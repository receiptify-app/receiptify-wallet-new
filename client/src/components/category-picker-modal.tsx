import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CATEGORIES, Category } from "@shared/categories";
import { Check } from "lucide-react";

interface CategoryPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (categoryId: string) => void;
  currentCategory?: string;
  title?: string;
}

export default function CategoryPickerModal({
  open,
  onClose,
  onSelect,
  currentCategory,
  title = "Select Category"
}: CategoryPickerModalProps) {
  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-category-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          {CATEGORIES.map((category: Category) => {
            const isSelected = currentCategory?.toLowerCase() === category.id || 
                             currentCategory?.toLowerCase() === category.name.toLowerCase();
            
            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto py-4 px-3 flex flex-col items-center gap-2 relative ${
                  isSelected ? 'border-2 border-primary' : ''
                }`}
                onClick={() => handleSelect(category.id)}
                data-testid={`button-category-${category.id}`}
                style={{
                  backgroundColor: isSelected ? category.color : 'transparent',
                  borderColor: isSelected ? category.color : undefined,
                  color: isSelected ? '#fff' : undefined
                }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4" />
                  </div>
                )}
                <span className="text-2xl">{category.icon}</span>
                <span className="text-xs font-medium text-center leading-tight">
                  {category.name}
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
