import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Scan from "@/pages/scan";
import Receipts from "@/pages/receipts";
import Cards from "@/pages/cards";
import Eco from "@/pages/eco";
import Profile from "@/pages/profile";
import Map from "@/pages/map";
import ReceiptDetail from "@/pages/receipt-detail";
import SplitReceipt from "@/pages/split-receipt";
import Subscriptions from "@/pages/subscriptions";
import Warranties from "@/pages/warranties";
import LinkedCards from "@/pages/linked-cards";
import Payment from "@/pages/payment";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import TestAuth from "@/pages/test-auth";
import BottomNavigation from "@/components/bottom-navigation";

function AuthenticatedRouter() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading Receiptify...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/test-auth" component={TestAuth} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scan" component={Scan} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/cards" component={Cards} />
        <Route path="/eco" component={Eco} />
        <Route path="/map" component={Map} />
        <Route path="/profile" component={Profile} />
        <Route path="/receipt/:id" component={ReceiptDetail} />
        <Route path="/split-receipt" component={SplitReceipt} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/warranties" component={Warranties} />
        <Route path="/linked-cards" component={LinkedCards} />
        <Route path="/payment" component={Payment} />
        <Route component={NotFound} />
      </Switch>
      <BottomNavigation />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <div className="max-w-sm mx-auto bg-white shadow-2xl min-h-screen relative overflow-hidden mobile-app">
            {/* Status Bar */}
            <div className="bg-white px-6 py-2 flex justify-between items-center text-sm font-medium">
              <span>9:41</span>
              <div className="flex items-center space-x-1 text-xs">
                <i className="fas fa-signal"></i>
                <i className="fas fa-wifi"></i>
                <i className="fas fa-battery-three-quarters"></i>
              </div>
            </div>

            <AuthenticatedRouter />
          </div>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
