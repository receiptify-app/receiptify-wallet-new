import { QueryClient, QueryFunction } from "@tanstack/react-query";

let authTokenGetter: (() => Promise<string | null>) | null = null;
let authReady = false;
let authReadyResolver: (() => void) | null = null;
const authReadyPromise = new Promise<void>((resolve) => {
  authReadyResolver = resolve;
});

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
  authReady = true;
  if (authReadyResolver) {
    authReadyResolver();
    authReadyResolver = null;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  
  if (!authReady) {
    await authReadyPromise;
  }
  
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        console.log("Auth token attached to request");
      } else {
        console.log("No auth token available (user not logged in)");
      }
    } catch (error) {
      console.warn("Failed to get auth token:", error);
    }
  } else {
    console.log("Auth token getter not set");
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
