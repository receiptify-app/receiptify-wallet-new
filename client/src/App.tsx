import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Scan from "@/pages/scan";
import Receipts from "@/pages/receipts";
import Profile from "@/pages/profile";
import Map from "@/pages/map";
import ReceiptDetail from "@/pages/receipt-detail";
import SplitReceipt from "@/pages/split-receipt";
import Payment from "@/pages/payment";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import TestAuth from "@/pages/test-auth";
import EmailSettings from "@/pages/EmailSettings";
import EmailImports from "@/pages/EmailImports";
import BottomNavigation from "@/components/bottom-navigation";
import ExportReceiptsPage from "@/pages/exports";
// import Warranties from "@/pages/warranties";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import VerifyEmail from "@/pages/verify-email";

function UserSync() {
  const { currentUser } = useAuth();

  useQuery({
    queryKey: ["/api/user"],
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return null;
}

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

  // Email/password users must verify their email before accessing the app
  if (!currentUser.emailVerified) {
    return <VerifyEmail />;
  }

  return (
    <>
      <Switch>
        <Route path="/" component={Scan} />
        <Route path="/scan" component={Scan} />
        <Route path="/analytics" component={Home} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/map" component={Map} />
        <Route path="/profile" component={Profile} />
        <Route path="/receipts/:id" component={ReceiptDetail} />
        <Route path="/split-receipt" component={SplitReceipt} />
        <Route path="/payment" component={Payment} />
        <Route path="/settings/email" component={EmailSettings} />
        <Route path="/inbox/imports" component={EmailImports} />
        <Route path="/exports" component={ExportReceiptsPage} />
        {/* <Route path="/warranties" component={Warranties} /> */}
        <Route path="/test-auth" component={TestAuth} />
        <Route path="/login">{() => { window.location.href = "/"; return null; }}</Route>
        <Route path="/signup">{() => { window.location.href = "/"; return null; }}</Route>
        <Route path="/forgot-password">{() => { window.location.href = "/"; return null; }}</Route>
        <Route component={NotFound} />
      </Switch>
      <BottomNavigation />
    </>
  );
}

function AdminRouter() {
  return (
    <AdminProvider>
      <Switch>
        <Route path="/admin" component={AdminLogin} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route component={AdminLogin} />
      </Switch>
    </AdminProvider>
  );
}

function MainRouter() {
  const [location] = useLocation();
  
  if (location.startsWith("/admin")) {
    return <AdminRouter />;
  }
  
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <UserSync />
        <div className="max-w-sm mx-auto bg-white shadow-2xl min-h-screen relative overflow-hidden mobile-app">
          <div className="bg-white px-6 py-2 flex justify-between items-center text-sm font-medium">
            <div className="flex items-center space-x-1 text-xs">
              <i className="fas fa-signal"></i>
              <i className="fas fa-wifi"></i>
              <i className="fas fa-battery-three-quarters"></i>
            </div>
          </div>
          <AuthenticatedRouter />
        </div>
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainRouter />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;