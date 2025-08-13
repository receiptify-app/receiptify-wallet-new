import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { Leaf } from "lucide-react";

export default function TestAuth() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>("");

  const testFirebaseConnection = async () => {
    setTesting(true);
    setResult("");
    
    try {
      console.log("Testing Firebase connection...");
      console.log("Firebase config:", {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "Set" : "Missing",
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "Missing",
        appId: import.meta.env.VITE_FIREBASE_APP_ID ? "Set" : "Missing"
      });
      
      // Try anonymous auth as a simple test
      const userCredential = await signInAnonymously(auth);
      setResult(`✅ Firebase connection successful! User ID: ${userCredential.user.uid}`);
      
      // Sign out the test user
      await auth.signOut();
    } catch (error: any) {
      console.error("Firebase test error:", error);
      setResult(`❌ Firebase error: ${error.code} - ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Receiptify</h1>
              <p className="text-sm text-gray-600">OneTap Receipts. Zero Paper.</p>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Firebase Test
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <Button
            onClick={testFirebaseConnection}
            disabled={testing}
            className="w-full h-12 bg-green-600 hover:bg-green-700"
          >
            {testing ? "Testing..." : "Test Firebase Connection"}
          </Button>
          
          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            <p>Environment Variables:</p>
            <ul className="mt-2 space-y-1">
              <li>API Key: {import.meta.env.VITE_FIREBASE_API_KEY ? "✅ Set" : "❌ Missing"}</li>
              <li>Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID || "❌ Missing"}</li>
              <li>App ID: {import.meta.env.VITE_FIREBASE_APP_ID ? "✅ Set" : "❌ Missing"}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}