import { Receipt } from "lucide-react";
import EcoStats from "./eco-stats";

export default function AppHeader() {
  return (
    <div className="bg-gradient-to-r from-light-green to-secondary px-6 py-4">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md">
          <Receipt className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Receiptify</h1>
          <p className="text-sm text-primary/70 font-medium">One Scan. Zero Paper.</p>
        </div>
      </div>
      
      <EcoStats />
    </div>
  );
}
