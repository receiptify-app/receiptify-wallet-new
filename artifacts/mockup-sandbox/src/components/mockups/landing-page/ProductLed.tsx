import React from "react";
import { 
  Leaf, 
  Camera, 
  Zap, 
  BarChart3, 
  ShieldCheck, 
  Smartphone, 
  ArrowRight,
  ScanLine,
  Mail,
  PieChart
} from "lucide-react";
import { Button } from "../../ui/button";

export function ProductLed() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-green-100 selection:text-green-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-green-500 p-1.5 rounded-lg text-slate-950">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Receiptify</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-white hover:text-green-400 hover:bg-white/5">
                Sign In
              </Button>
              <Button className="bg-green-500 hover:bg-green-600 text-slate-950 font-semibold rounded-full px-6">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-green-900/20 via-slate-950 to-slate-950"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Hero Copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-sm font-medium mb-6 border border-green-500/20">
                <Zap className="w-4 h-4" />
                <span>Smarter spending for the UK</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                Your receipt wallet — <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                  store, track, return
                </span><br/>
                stress-free.
              </h1>
              <p className="text-lg lg:text-xl text-slate-400 mb-8 max-w-xl leading-relaxed">
                Ditch the paper clutter. Receiptify automatically scans, categorizes, and tracks your receipts while calculating your carbon savings. 
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-green-500 hover:bg-green-600 text-slate-950 font-semibold rounded-full px-8 h-14 text-lg w-full sm:w-auto">
                  Sign Up for Free
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg border-slate-700 text-slate-800 bg-white hover:bg-slate-100 w-full sm:w-auto gap-2">
                  <Smartphone className="w-5 h-5" />
                  Download App
                </Button>
              </div>
              
              <div className="mt-10 flex items-center gap-4 text-sm text-slate-500">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {String.fromCharCode(64+i)}
                    </div>
                  ))}
                </div>
                <p>Trusted by 10,000+ UK shoppers</p>
              </div>
            </div>

            {/* Hero Mockup */}
            <div className="relative mx-auto lg:ml-auto w-full max-w-[340px] perspective-1000">
              <div className="relative w-full aspect-[1/2.1] bg-white rounded-[2.5rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                {/* Dynamic Island */}
                <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
                  <div className="w-24 h-6 bg-slate-900 rounded-b-3xl"></div>
                </div>

                {/* App UI */}
                <div className="absolute inset-0 bg-slate-50 flex flex-col">
                  {/* Header */}
                  <div className="bg-green-600 pt-12 pb-6 px-5 text-white rounded-b-3xl shadow-sm">
                    <p className="text-green-100 text-sm font-medium">Total Spent (This Month)</p>
                    <h2 className="text-3xl font-bold mt-1">£842.50</h2>
                  </div>

                  {/* Eco Stats Mini */}
                  <div className="px-5 -mt-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-xl text-green-600">
                          <Leaf className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Eco Impact</p>
                          <p className="text-sm font-bold text-slate-900">12 Trees Saved</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium">CO₂ Reduced</p>
                        <p className="text-sm font-bold text-slate-900">4.2 kg</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Receipts */}
                  <div className="flex-1 px-5 pt-6 pb-4 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-900">Recent Receipts</h3>
                      <span className="text-xs text-green-600 font-semibold cursor-pointer">View All</span>
                    </div>
                    
                    <div className="flex flex-col gap-3 flex-1">
                      {/* Item 1 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                            TE
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Tesco Extra</p>
                            <p className="text-xs text-slate-500">Groceries • Today</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">£45.20</p>
                      </div>
                      
                      {/* Item 2 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-sm">
                            WA
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Waitrose</p>
                            <p className="text-xs text-slate-500">Groceries • Yesterday</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">£12.50</p>
                      </div>

                      {/* Item 3 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-bold text-sm">
                            SH
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Shell</p>
                            <p className="text-xs text-slate-500">Transport • 3 days ago</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">£65.00</p>
                      </div>
                      
                      {/* Item 4 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm opacity-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                            AM
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Amazon UK</p>
                            <p className="text-xs text-slate-500">Shopping • 4 days ago</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">£29.99</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Nav Mock */}
                  <div className="h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 pb-2">
                    <div className="flex flex-col items-center gap-1 text-green-600">
                      <BarChart3 className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <ScanLine className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Scan</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <PieChart className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Analytics</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements behind phone */}
              <div className="absolute top-20 -right-12 w-24 h-24 bg-green-500 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse"></div>
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights (Horizontal Cards) */}
      <section id="features" className="py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything your receipts need</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Powerful features wrapped in an intuitive interface. Manage warranties, track expenses, and reduce your carbon footprint.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-6">
                <Camera className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI-Powered Scanning</h3>
              <p className="text-slate-600 leading-relaxed">
                Snap a photo or scan a QR code. Our intelligent OCR instantly extracts merchant names, items, prices, and tax info with pinpoint accuracy.
              </p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <Leaf className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Eco-Impact Tracking</h3>
              <p className="text-slate-600 leading-relaxed">
                See the real-world impact of going paperless. Track how many trees you've saved and your total CO₂ reduction in real-time.
              </p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Warranty Watchdog</h3>
              <p className="text-slate-600 leading-relaxed">
                Never lose a receipt for a return again. We automatically flag warranties and alert you before the return window closes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">How Receiptify works</h2>
              <p className="text-lg text-slate-600 mb-10">Three simple steps to digitize your spending and clear out your wallet forever.</p>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-lg">1</div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Capture or Forward</h4>
                    <p className="text-slate-600">Scan paper receipts with your camera, or simply forward email receipts to <span className="font-semibold text-slate-900">inbox@receiptify.uk</span>.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500 text-slate-900 rounded-full flex items-center justify-center font-bold text-lg">2</div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Auto-Categorization</h4>
                    <p className="text-slate-600">Our AI instantly reads the data, categorizes the expense (Groceries, Tech, Travel), and files it away securely.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-lg">3</div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Analyze & Return</h4>
                    <p className="text-slate-600">Search your entire receipt history in seconds when you need a refund, and view gorgeous charts of your monthly spending.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-square bg-slate-100 rounded-[3rem] p-8 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 opacity-50"></div>
                
                {/* Abstract representation of the process */}
                <div className="relative z-10 w-full max-w-sm">
                  <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 mb-4 transform -rotate-3 translate-x-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center"><Mail className="w-6 h-6"/></div>
                      <div>
                        <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 w-16 bg-slate-100 rounded"></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mb-4">
                    <ArrowRight className="w-8 h-8 text-green-500 transform rotate-90 lg:rotate-0" />
                  </div>
                  
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-green-100 transform rotate-2 -translate-x-2 border-l-4 border-l-green-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-bold">AP</div>
                        <span className="font-bold text-sm">Apple Store</span>
                      </div>
                      <span className="font-bold">£1,299.00</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>MacBook Air M3</span>
                        <span>£1,299.00</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">Tech</span>
                        <span className="text-xs text-orange-500 font-medium flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Warranty active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-green-600 rounded-[3rem] p-12 lg:p-16 text-center text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full mix-blend-screen filter blur-3xl opacity-50 transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-700 rounded-full mix-blend-multiply filter blur-3xl opacity-50 transform -translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">Ready to clear your wallet?</h2>
              <p className="text-xl text-green-100 mb-10 max-w-2xl mx-auto">
                Join thousands of UK consumers who have switched to a smarter, greener way to manage their receipts.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" className="bg-slate-950 hover:bg-slate-900 text-white font-semibold rounded-full px-10 h-14 text-lg">
                  Get Started for Free
                </Button>
              </div>
              <p className="mt-6 text-sm text-green-200">No credit card required. Free forever for personal use.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-green-500 p-1 rounded text-slate-950">
              <Leaf className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-slate-900">Receiptify</span>
          </div>
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Receiptify UK Ltd. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-green-600">Privacy</a>
            <a href="#" className="hover:text-green-600">Terms</a>
            <a href="#" className="hover:text-green-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
