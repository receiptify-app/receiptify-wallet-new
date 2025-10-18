import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Edit } from "lucide-react";
import ManualReceiptForm from "@/components/manual-receipt-form";

export default function Scan() {
  const [showManualForm, setShowManualForm] = useState(false);

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Add Receipt</h1>
        <p className="text-gray-600">Enter your receipt details manually</p>
      </div>

      {/* Manual Entry Option */}
      <div className="space-y-4 mb-8">
        <Card className="hover:shadow-md transition-shadow border-2 border-primary">
          <CardContent className="p-6">
            <Button
              onClick={() => setShowManualForm(true)}
              className="w-full h-auto py-6 bg-primary hover:bg-primary/90"
            >
              <div className="flex items-center justify-center space-x-4">
                <div className="w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                  <Edit className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg text-primary-foreground">Import Receipt</div>
                  <div className="text-sm text-primary-foreground/80">Enter receipt information manually</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Information Section */}
      <Card className="bg-light-green border-accent/20">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">Privacy First</h3>
              <p className="text-sm text-gray-700 mb-3">
                All receipts are stored securely. Manual entry ensures complete control over your data.
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <div>✓ Support for all major UK retailers</div>
                <div>✓ Automatic categorization</div>
                <div>✓ Works with any payment method</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Receipt Form */}
      <ManualReceiptForm 
        open={showManualForm} 
        onOpenChange={setShowManualForm}
      />
    </div>
  );
}
