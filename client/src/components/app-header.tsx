import { Receipt } from "lucide-react";
import EcoStats from "./eco-stats";
import logoSrc from "@assets/2C508BEA-D169-4FDB-A1F9-0F6E333C1A18_1754620280792.png";

export default function AppHeader() {
  return (
    <div className="bg-gradient-to-r from-light-green to-secondary px-6 py-4">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md p-1">
          <img 
            src={logoSrc} 
            alt="Receiptify Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Receiptify</h1>
          <p className="text-sm text-primary/70 font-medium">OneTap Receipts. Zero Paper.</p>
        </div>
      </div>
      
      <EcoStats />
    </div>
  );
}
