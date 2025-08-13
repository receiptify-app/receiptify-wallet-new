import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Leaf, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import FirebaseSetupHelp from "@/components/firebase-setup-help";

export default function TestAuth() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const testFirebaseConnection = async () => {
    setTesting(true);
    setResult("");
    
    try {
      console.log("Testing Firebase connection...");
      const configInfo = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "Set" : "Missing",
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "Missing",
        appId: import.meta.env.VITE_FIREBASE_APP_ID ? "Set" : "Missing"
      };
      console.log("Firebase config:", configInfo);
      
      setResult(`🔍 Testing Firebase connection...\n\nConfig Status:\n${JSON.stringify(configInfo, null, 2)}\n\n`);
      
      // Try anonymous auth as a simple test
      try {
        const userCredential = await signInAnonymously(auth);
        setResult(prev => prev + `✅ Firebase connection successful!\nUser ID: ${userCredential.user.uid}\n\n`);
        
        // Sign out the test user
        await auth.signOut();
        setResult(prev => prev + `✅ Anonymous auth test passed\n\n`);
      } catch (anonError: any) {
        setResult(prev => prev + `❌ Anonymous auth failed: ${anonError.code}\nMessage: ${anonError.message}\n\n`);
      }
      
      // Test Google Auth provider (don't actually sign in, just test provider creation)
      try {
        const provider = new GoogleAuthProvider();
        setResult(prev => prev + `✅ Google Auth provider created successfully\n`);
        
        // Test if we can trigger a popup (this will show the actual error)
        try {
          await signInWithPopup(auth, provider);
          setResult(prev => prev + `✅ Google sign-in successful!\n`);
          await auth.signOut();
        } catch (googleError: any) {
          setResult(prev => prev + `❌ Google sign-in failed: ${googleError.code}\nMessage: ${googleError.message}\n\nCommon fixes:\n- Enable Google provider in Firebase Console\n- Add ${window.location.hostname} to authorized domains\n- Check if popups are blocked\n\n`);
        }
      } catch (googleError: any) {
        setResult(prev => prev + `❌ Google Auth setup failed: ${googleError.message}\n`);
      }
      
      setResult(prev => prev + `✅ Test completed`);
      
    } catch (error: any) {
      console.error("Firebase test error:", error);
      setResult(prev => prev + `❌ Firebase error: ${error.code}\nMessage: ${error.message}\n\nDetailed error:\n${JSON.stringify(error, null, 2)}`);
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
          
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSetupHelp(!showSetupHelp)}
              variant="outline"
              className="w-full h-12"
            >
              {showSetupHelp ? "Hide" : "Show"} Setup Guide
            </Button>
            
            <Link href="/">
              <Button variant="outline" size="icon" className="h-12 w-12">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {showSetupHelp && <FirebaseSetupHelp />}
    </div>
  );
}