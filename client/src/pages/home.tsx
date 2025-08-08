import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import AppHeader from "@/components/app-header";
import EcoStats from "@/components/eco-stats";
import ReceiptCard from "@/components/receipt-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, TrendingUp, Calendar } from "lucide-react";
import ScannerModal from "@/components/scanner-modal";
import type { Receipt } from "@shared/schema";

const categoryFilters = [
  { label: "All", value: "" },
  { label: "Groceries", value: "Groceries" },
  { label: "Fuel", value: "Fuel" },
  { label: "Retail", value: "Retail" },
  { label: "Dining", value: "Dining" },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts", selectedCategory],
    enabled: true,
  });

  const { data: searchResults = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/search"],
    enabled: false,
  });

  const filteredReceipts = searchQuery 
    ? receipts.filter(receipt => 
        receipt.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.location?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : receipts;

  const totalSpending = receipts.reduce((sum, receipt) => sum + parseFloat(receipt.total), 0);

  return (
    <div className="pb-24">
      <AppHeader />

      <div className="px-6 py-4">
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative mb-4">
            <Input
              type="text"
              placeholder="Search receipts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-100 border-0 focus:ring-2 focus:ring-accent"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            {categoryFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={selectedCategory === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(filter.value)}
                className={`whitespace-nowrap text-xs ${
                  selectedCategory === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Receipts List */}
        <div className="space-y-4 mb-8">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      <div>
                        <div className="h-4 w-24 bg-gray-200 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 w-12 bg-gray-200 rounded mb-1"></div>
                      <div className="h-3 w-16 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No receipts found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? "Try a different search term" : "Start scanning receipts to see them here"}
              </p>
              <Button onClick={() => setShowScanner(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Receipt
              </Button>
            </div>
          ) : (
            filteredReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="text-accent w-5 h-5" />
              <span className="font-medium text-gray-900">Spending Trends</span>
            </div>
            <p className="text-xs text-gray-600">£{totalSpending.toFixed(2)} this month</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3 mb-2">
              <Calendar className="text-accent w-5 h-5" />
              <span className="font-medium text-gray-900">Subscriptions</span>
            </div>
            <p className="text-xs text-gray-600">3 active subscriptions</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Button
        onClick={() => setShowScanner(true)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 p-0"
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* Scanner Modal */}
      <ScannerModal open={showScanner} onOpenChange={setShowScanner} />
    </div>
  );
}
