import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Scan from "@/pages/scan";
import Cards from "@/pages/cards";
import Eco from "@/pages/eco";
import Profile from "@/pages/profile";
import Map from "@/pages/map";
import ReceiptDetail from "@/pages/receipt-detail";
import Subscriptions from "@/pages/subscriptions";
import Warranties from "@/pages/warranties";
import Landing from "@/pages/landing";
import BottomNavigation from "@/components/bottom-navigation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/scan" component={Scan} />
      <Route path="/cards" component={Cards} />
      <Route path="/eco" component={Eco} />
      <Route path="/map" component={Map} />
      <Route path="/profile" component={Profile} />
      <Route path="/receipt/:id" component={ReceiptDetail} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/warranties" component={Warranties} />
      <Route path="/welcome" component={Landing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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

          <Router />
          <BottomNavigation />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
