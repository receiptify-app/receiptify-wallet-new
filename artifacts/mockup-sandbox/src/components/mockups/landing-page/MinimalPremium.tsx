import React from "react";
import { ArrowRight, Leaf, ShieldCheck, Zap, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MinimalPremium() {
  return (
    <div className="min-h-screen bg-white text-zinc-950 font-['Inter'] selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Receiptify</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-zinc-500 hover:text-zinc-900 transition-colors hidden md:block">
              Features
            </a>
            <a href="#about" className="text-zinc-500 hover:text-zinc-900 transition-colors hidden md:block">
              About
            </a>
            <div className="flex items-center gap-4 ml-4">
              <a href="#signin" className="text-zinc-600 hover:text-zinc-900 transition-colors">
                Sign In
              </a>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-sm">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-['Playfair_Display'] text-6xl md:text-8xl font-medium tracking-tight text-zinc-900 leading-[1.05] mb-8">
            Store, track, return. <br className="hidden md:block" />
            <span className="text-zinc-400">Stress-free.</span>
          </h1>
          <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
            The digital receipt wallet for the conscious consumer. Keep your purchases organized, track your environmental impact, and never lose a warranty again.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-base bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm w-full sm:w-auto group">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full w-full sm:w-auto border-zinc-200 text-zinc-600 hover:bg-zinc-50">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-32 px-6 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-20">
            {/* Feature 1 */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                <Zap className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-['Playfair_Display'] text-2xl font-medium mb-3">Instant Capture</h3>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Scan physical receipts or forward digital ones. Our AI instantly extracts line items, totals, and merchant details with pinpoint accuracy.
              </p>
            </div>

            {/* Feature 2 */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                <Leaf className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-['Playfair_Display'] text-2xl font-medium mb-3">Eco-Impact Tracking</h3>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Watch your environmental footprint shrink. We calculate the paper, water, and CO₂ you save by choosing digital over physical.
              </p>
            </div>

            {/* Feature 3 */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-['Playfair_Display'] text-2xl font-medium mb-3">Warranty Protection</h3>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Never miss a return window. We automatically identify warranties and return policies, notifying you before they expire.
              </p>
            </div>

            {/* Feature 4 */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                <LineChart className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-['Playfair_Display'] text-2xl font-medium mb-3">Spending Insights</h3>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Understand where your money goes. Beautiful, effortless analytics categorized automatically for your peace of mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-40 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-['Playfair_Display'] text-4xl md:text-5xl font-medium leading-tight mb-12">
            "Receiptify completely transformed how I manage my expenses. It's quiet, beautiful, and just works."
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-200 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Sarah J." className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <div className="font-medium text-zinc-900">Sarah Jenkins</div>
              <div className="text-zinc-500 text-sm">Small Business Owner</div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width CTA */}
      <section className="py-32 px-6 bg-zinc-950 text-white selection:bg-emerald-900 selection:text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-['Playfair_Display'] text-5xl md:text-7xl font-medium mb-8">
            Ready for clarity?
          </h2>
          <p className="text-xl text-zinc-400 mb-12 max-w-xl mx-auto font-light">
            Join thousands of UK consumers organizing their lives and reducing their environmental footprint.
          </p>
          <Button size="lg" className="h-14 px-10 text-base bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg group">
            Sign Up Now
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-zinc-900">Receiptify</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
