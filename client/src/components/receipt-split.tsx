import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Share2, Users, Send, Copy, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Receipt, ReceiptItem } from "@shared/schema";

interface ReceiptSplitProps {
  receipt: Receipt;
  items: ReceiptItem[];
}

interface SplitPerson {
  name: string;
  phone: string;
  items: string[];
  total: number;
}

export default function ReceiptSplit({ receipt, items }: ReceiptSplitProps) {
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('items');
  const [people, setPeople] = useState<SplitPerson[]>([
    { name: 'You', phone: '', items: [], total: 0 }
  ]);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createSplitMutation = useMutation({
    mutationFn: async (splitData: any) => {
      const response = await fetch('/api/splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(splitData),
      });
      if (!response.ok) throw new Error('Failed to create split');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Split created successfully",
        description: "Payment links have been generated for all participants.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/splits'] });
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to create split",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  });

  const addPerson = () => {
    setPeople([...people, { name: '', phone: '', items: [], total: 0 }]);
  };

  const updatePerson = (index: number, field: keyof SplitPerson, value: any) => {
    const updated = [...people];
    updated[index] = { ...updated[index], [field]: value };
    setPeople(updated);
  };

  const toggleItemForPerson = (itemId: string, personIndex: number) => {
    const updated = { ...selectedItems };
    if (!updated[itemId]) updated[itemId] = [];
    
    const personName = people[personIndex].name || `Person ${personIndex + 1}`;
    const index = updated[itemId].indexOf(personName);
    
    if (index > -1) {
      updated[itemId].splice(index, 1);
    } else {
      updated[itemId].push(personName);
    }
    
    setSelectedItems(updated);
    calculateTotals(updated);
  };

  const calculateTotals = (itemAssignments: Record<string, string[]>) => {
    const updatedPeople = people.map(person => ({
      ...person,
      total: 0
    }));

    items.forEach(item => {
      const assignedTo = itemAssignments[item.id] || [];
      if (assignedTo.length > 0) {
        const itemPrice = parseFloat(item.price);
        const splitAmount = itemPrice / assignedTo.length;
        
        assignedTo.forEach(personName => {
          const personIndex = updatedPeople.findIndex(p => 
            (p.name || `Person ${updatedPeople.indexOf(p) + 1}`) === personName
          );
          if (personIndex > -1) {
            updatedPeople[personIndex].total += splitAmount;
          }
        });
      }
    });

    setPeople(updatedPeople);
  };

  const handleCreateSplit = () => {
    const splitData = {
      receiptId: receipt.id,
      splitType: splitMode,
      participants: people.map(person => ({
        name: person.name || 'Anonymous',
        phone: person.phone,
        amount: person.total.toFixed(2),
        items: items.filter(item => 
          selectedItems[item.id]?.includes(person.name || `Person ${people.indexOf(person) + 1}`)
        ).map(item => item.id)
      }))
    };

    createSplitMutation.mutate(splitData);
  };

  const copyPaymentLink = () => {
    const link = `https://pay.receiptify.com/split/${receipt.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Payment link has been copied to clipboard",
    });
  };

  const totalAmount = parseFloat(receipt.total);
  const assignedAmount = people.reduce((sum, person) => sum + person.total, 0);
  const remainingAmount = totalAmount - assignedAmount;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Split Receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Split Receipt - {receipt.merchantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Split Mode Selection */}
          <div className="flex gap-4">
            <Button
              variant={splitMode === 'items' ? 'default' : 'outline'}
              onClick={() => setSplitMode('items')}
              className="flex-1"
            >
              Split by Items
            </Button>
            <Button
              variant={splitMode === 'equal' ? 'default' : 'outline'}
              onClick={() => setSplitMode('equal')}
              className="flex-1"
            >
              Split Equally
            </Button>
          </div>

          {/* People Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {people.map((person, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <div className="flex-1">
                    <Input
                      placeholder={index === 0 ? "Your name" : "Participant name"}
                      value={person.name}
                      onChange={(e) => updatePerson(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Phone number"
                      value={person.phone}
                      onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                    />
                  </div>
                  <div className="w-24 text-right font-medium">
                    £{person.total.toFixed(2)}
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addPerson} className="w-full">
                + Add Person
              </Button>
            </CardContent>
          </Card>

          {/* Item Assignment */}
          {splitMode === 'items' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assign Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">£{item.price}</div>
                      </div>
                      <div className="flex gap-2">
                        {people.map((person, personIndex) => (
                          <div key={personIndex} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${item.id}-${personIndex}`}
                              checked={selectedItems[item.id]?.includes(
                                person.name || `Person ${personIndex + 1}`
                              ) || false}
                              onCheckedChange={() => toggleItemForPerson(item.id, personIndex)}
                            />
                            <Label 
                              htmlFor={`${item.id}-${personIndex}`}
                              className="text-xs"
                            >
                              {person.name || `Person ${personIndex + 1}`}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Receipt Amount:</span>
                <span className="font-bold">£{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>Assigned Amount:</span>
                <span>£{assignedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Remaining:</span>
                <span className={remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                  £{remainingAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Links */}
          <Card className="bg-light-green">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-primary">Payment Link</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPaymentLink}
                  className="flex items-center gap-1"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Share this link for participants to pay their portion
              </div>
              <code className="text-xs bg-white p-2 rounded block">
                https://pay.receiptify.com/split/{receipt.id}
              </code>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleCreateSplit}
              disabled={createSplitMutation.isPending || remainingAmount !== 0}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              {createSplitMutation.isPending ? 'Creating...' : 'Send Payment Links'}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}