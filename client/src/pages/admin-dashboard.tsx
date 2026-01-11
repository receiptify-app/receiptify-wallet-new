import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  UserPlus, 
  TrendingUp, 
  UserMinus, 
  Activity, 
  LogOut,
  Plus,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";
import { useAdmin } from "@/contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Metrics {
  totalSignups: number;
  totalUsers: number;
  dailyActiveUsers: number;
  signupDropoffs: number;
  recentSignups30Days: number;
  weeklyActiveUsers: number[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AppUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  authProvider: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("adminToken");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { admin, isAuthenticated, loading, logout } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ name: "", email: "", password: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["/api/admin/metrics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/metrics", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: adminsData, isLoading: adminsLoading, refetch: refetchAdmins } = useQuery({
    queryKey: ["/api/admin/list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/list", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to fetch admins");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const res = await fetch("/api/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create admin");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Admin created", description: "New admin account has been created." });
      setCreateAdminOpen(false);
      setNewAdminForm({ name: "", email: "", password: "" });
      refetchAdmins();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create admin", description: error.message, variant: "destructive" });
    },
  });

  const deactivateAdminMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/${id}/deactivate`, {
        method: "PATCH",
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to deactivate admin");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Admin deactivated", description: "Admin account has been deactivated." });
      refetchAdmins();
    },
    onError: (error: any) => {
      toast({ title: "Failed to deactivate", description: error.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin");
  };

  const handleCreateAdmin = () => {
    if (!newAdminForm.name || !newAdminForm.email || !newAdminForm.password) {
      toast({ title: "Missing fields", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (newAdminForm.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    createAdminMutation.mutate(newAdminForm);
  };

  const metrics: Metrics = metricsData?.metrics || {
    totalSignups: 0,
    totalUsers: 0,
    dailyActiveUsers: 0,
    signupDropoffs: 0,
    recentSignups30Days: 0,
    weeklyActiveUsers: [0, 0, 0, 0, 0, 0, 0],
  };

  const admins: AdminUser[] = adminsData?.admins || [];
  const users: AppUser[] = usersData?.users || [];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/admin");
    }
  }, [loading, isAuthenticated, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (will redirect via useEffect)
  if (!isAuthenticated) {
    return null;
  }

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxDau = Math.max(...metrics.weeklyActiveUsers, 1);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Receiptify Admin</h1>
              <p className="text-sm text-slate-400">Welcome, {admin?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="metrics" className="data-[state=active]:bg-blue-600">
              <Activity className="w-4 h-4 mr-2" />
              Performance Metrics
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="admins" className="data-[state=active]:bg-blue-600">
              <Shield className="w-4 h-4 mr-2" />
              Admin Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Performance Metrics</h2>
              <Button onClick={() => refetchMetrics()} variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Total Sign Ups</CardTitle>
                  <UserPlus className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{metrics.totalSignups}</div>
                  <p className="text-xs text-slate-400 mt-1">All time registrations</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Daily Active Users</CardTitle>
                  <Activity className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{metrics.dailyActiveUsers}</div>
                  <p className="text-xs text-slate-400 mt-1">Users active today</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Signup Dropoffs</CardTitle>
                  <UserMinus className="w-5 h-5 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{metrics.signupDropoffs}</div>
                  <p className="text-xs text-slate-400 mt-1">Users who abandoned signup</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Recent Signups (30d)</CardTitle>
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{metrics.recentSignups30Days}</div>
                  <p className="text-xs text-slate-400 mt-1">New users this month</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Weekly Active Users</CardTitle>
                <CardDescription className="text-slate-400">Daily active users over the past 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-48 gap-2">
                  {metrics.weeklyActiveUsers.map((dau, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-blue-600 rounded-t transition-all"
                        style={{ height: `${Math.max((dau / maxDau) * 100, 5)}%` }}
                      />
                      <span className="text-xs text-slate-400">{dayLabels[index]}</span>
                      <span className="text-xs text-white font-medium">{dau}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">User Management</h2>
              <span className="text-slate-400">{users.length} total users</span>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Provider</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Last Login</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading users...</td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found</td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                  : user.username || "Unknown"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{user.email || "-"}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-slate-600 text-slate-200 rounded text-xs">
                                {user.authProvider || "local"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${user.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm">
                              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm">
                              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Admin Management</h2>
              <Button onClick={() => setCreateAdminOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Last Login</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {adminsLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading admins...</td>
                        </tr>
                      ) : admins.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No admins found</td>
                        </tr>
                      ) : (
                        admins.map((adminUser) => (
                          <tr key={adminUser.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-white font-medium">{adminUser.name}</td>
                            <td className="px-4 py-3 text-slate-300">{adminUser.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${adminUser.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                                {adminUser.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm">
                              {adminUser.lastLoginAt ? new Date(adminUser.lastLoginAt).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm">
                              {adminUser.createdAt ? new Date(adminUser.createdAt).toLocaleDateString() : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {adminUser.id !== admin?.id && adminUser.isActive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-600 text-red-400 hover:bg-red-900/50"
                                  onClick={() => deactivateAdminMutation.mutate(adminUser.id)}
                                  disabled={deactivateAdminMutation.isPending}
                                >
                                  Deactivate
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Admin</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new administrator to manage Receiptify
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Full Name</Label>
              <Input
                value={newAdminForm.name}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                placeholder="Admin Name"
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Email</Label>
              <Input
                type="email"
                value={newAdminForm.email}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                placeholder="admin@receiptify.com"
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newAdminForm.password}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="bg-slate-700/50 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAdminOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin} disabled={createAdminMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
