import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AdminContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupAdmin: (email: string, password: string, name: string) => Promise<void>;
  checkSetup: () => Promise<boolean>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem("adminToken");
  const setToken = (token: string) => localStorage.setItem("adminToken", token);
  const removeToken = () => localStorage.removeItem("adminToken");

  useEffect(() => {
    const validateSession = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAdmin(data.admin);
        } else {
          removeToken();
        }
      } catch (error) {
        console.error("Session validation error:", error);
        removeToken();
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    setToken(data.token);
    setAdmin(data.admin);
  };

  const logout = async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    removeToken();
    setAdmin(null);
  };

  const setupAdmin = async (email: string, password: string, name: string) => {
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Setup failed");
    }

    const data = await response.json();
    setToken(data.token);
    setAdmin(data.admin);
  };

  const checkSetup = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/admin/check-setup");
      const data = await response.json();
      return data.needsSetup;
    } catch (error) {
      console.error("Check setup error:", error);
      return false;
    }
  };

  const value: AdminContextType = {
    admin,
    isAuthenticated: !!admin,
    loading,
    login,
    logout,
    setupAdmin,
    checkSetup,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
