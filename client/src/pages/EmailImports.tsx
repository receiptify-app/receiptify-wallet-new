import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Edit, Mail, FileText, DollarSign, Calendar } from "lucide-react";

interface PendingReceipt {
  id: string;
  messageId: string;
  extractedData: {
    merchant: string;
    amount: string;
    date: string;
    lineItems: Array<{
      name: string;
      price: string;
      quantity: number;
    }>;
    confidence: number;
    attachments: Array<{
      filename: string;
      url: string;
      mime: string;
    }>;
  };
  confidence: number;
  status: string;
  createdAt: string;
}

interface EditReceiptData {
  merchant: string;
  amount: string;
  date: string;
  items: string;
}

export default function EmailImports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingReceipt, setEditingReceipt] = useState<PendingReceipt | null>(null);
  const [editData, setEditData] = useState<EditReceiptData>({
    merchant: '',
    amount: '',
    date: '',
    items: ''
  });

  // Query pending receipts
  const { data: pendingReceipts, isLoading } = useQuery({
    queryKey: ['/api/email/pending'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/pending');
      const data = await response.json();
      return data.pendingReceipts || [];
    }
  });

  // Accept receipt mutation
  const acceptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      await apiRequest('POST', `/api/email/pending/${receiptId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/pending'] });
      toast({
        title: "Receipt Accepted",
        description: "Receipt has been added to your collection",
      });
    },
    onError: (error) => {
      toast({
        title: "Accept Failed",
        description: "Failed to accept receipt",
        variant: "destructive",
      });
    }
  });

  // Reject receipt mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ receiptId, reason }: { receiptId: string; reason?: string }) => {
      await apiRequest('POST', `/api/email/pending/${receiptId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/pending'] });
      toast({
        title: "Receipt Rejected",
        description: "Receipt has been marked as rejected",
      });
    },
    onError: (error) => {
      toast({
        title: "Reject Failed",
        description: "Failed to reject receipt",
        variant: "destructive",
      });
    }
  });

  // Edit and accept mutation
  const editAcceptMutation = useMutation({
    mutationFn: async ({ receiptId, editData }: { receiptId: string; editData: EditReceiptData }) => {
      await apiRequest('POST', `/api/email/pending/${receiptId}/accept`, {
        merchant: editData.merchant,
        amount: editData.amount,
        date: editData.date,
        items: editData.items
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/pending'] });
      setEditingReceipt(null);
      toast({
        title: "Receipt Updated",
        description: "Receipt has been updated and accepted",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update receipt",
        variant: "destructive",
      });
    }
  });

  const openEditDialog = (receipt: PendingReceipt) => {
    setEditingReceipt(receipt);
    setEditData({
      merchant: receipt.extractedData.merchant || '',
      amount: receipt.extractedData.amount || '',
      date: receipt.extractedData.date || '',
      items: receipt.extractedData.lineItems?.map(item => 
        `${item.name} - $${item.price} (x${item.quantity})`
      ).join('\n') || ''
    });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-800">High Confidence</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">Medium Confidence</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low Confidence</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Email Imports</h1>
        <Badge variant="secondary">
          {pendingReceipts?.length || 0} pending
        </Badge>
      </div>

      {pendingReceipts?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Pending Imports</CardTitle>
            <CardDescription>
              All your email receipts have been processed. New receipts will appear here for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Connect your email accounts in settings to start importing receipts automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingReceipts?.map((receipt: PendingReceipt) => (
            <Card key={receipt.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle className="text-lg">{receipt.extractedData.merchant || 'Unknown Merchant'}</CardTitle>
                    {getConfidenceBadge(receipt.confidence)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(receipt.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">${receipt.extractedData.amount || '0.00'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>{receipt.extractedData.date ? new Date(receipt.extractedData.date).toLocaleDateString() : 'No date'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span>{receipt.extractedData.lineItems?.length || 0} items</span>
                  </div>
                </div>

                {/* Line Items Preview */}
                {receipt.extractedData.lineItems && receipt.extractedData.lineItems.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Items:</h4>
                    <div className="bg-muted rounded p-3 text-sm">
                      {receipt.extractedData.lineItems.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{item.name}</span>
                          <span>${item.price}</span>
                        </div>
                      ))}
                      {receipt.extractedData.lineItems.length > 3 && (
                        <div className="text-muted-foreground">
                          +{receipt.extractedData.lineItems.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OCR Text Preview */}
                {receipt.extractedData.attachments && receipt.extractedData.attachments.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Attachments:</h4>
                    <div className="space-y-1">
                      {receipt.extractedData.attachments.map((attachment, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          📎 {attachment.filename}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    onClick={() => acceptMutation.mutate(receipt.id)}
                    disabled={acceptMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => openEditDialog(receipt)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Receipt</DialogTitle>
                        <DialogDescription>
                          Review and edit the extracted receipt information before accepting.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="merchant">Merchant</Label>
                          <Input
                            id="merchant"
                            value={editData.merchant}
                            onChange={(e) => setEditData(prev => ({ ...prev, merchant: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="amount">Amount</Label>
                          <Input
                            id="amount"
                            value={editData.amount}
                            onChange={(e) => setEditData(prev => ({ ...prev, amount: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={editData.date ? new Date(editData.date).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="items">Items (one per line)</Label>
                          <Textarea
                            id="items"
                            value={editData.items}
                            onChange={(e) => setEditData(prev => ({ ...prev, items: e.target.value }))}
                            rows={5}
                            placeholder="Item name - $price (xquantity)"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditingReceipt(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => editingReceipt && editAcceptMutation.mutate({ 
                            receiptId: editingReceipt.id, 
                            editData 
                          })}
                          disabled={editAcceptMutation.isPending}
                        >
                          Save & Accept
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    onClick={() => rejectMutation.mutate({ receiptId: receipt.id })}
                    disabled={rejectMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}