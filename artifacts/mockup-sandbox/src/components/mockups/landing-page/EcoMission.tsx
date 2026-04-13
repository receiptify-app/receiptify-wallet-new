import React, { useEffect, useState } from "react";
import { 
  Leaf, 
  Wind, 
  TreePine, 
  Receipt, 
  Scan, 
  ShieldCheck, 
  ArrowRight,
  Menu,
  X,
  Globe,
  BarChart3
} from "lucide-react";

export function EcoMission() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [receiptsCount, setReceiptsCount] = useState(847000);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setReceiptsCount(prev => prev + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A2E20] font-sans selection:bg-[#2C5E3B] selection:text-white">
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#2C5E3B] text-white p-2 rounded-lg">
              <Leaf className="w-5 h-5" />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isScrolled ? "text-[#1A2E20]" : "text-white"}`}>
              Receiptify
            </span>
          </div>

          {/* Desktop Nav */}
          <div className={`hidden md:flex items-center gap-8 font-medium ${isScrolled ? "text-[#4A5E50]" : "text-white/90"}`}>
            <a href="#impact" className="hover:text-[#2C5E3B] transition-colors">Our Impact</a>
            <a href="#features" className="hover:text-[#2C5E3B] transition-colors">How it Works</a>
            <a href="#mission" className="hover:text-[#2C5E3B] transition-colors">The Mission</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button className={`font-medium px-4 py-2 rounded-full transition-colors ${
              isScrolled ? "text-[#1A2E20] hover:bg-black/5" : "text-white hover:bg-white/10"
            }`}>
              Sign In
            </button>
            <button className="bg-[#2C5E3B] text-white px-6 py-2.5 rounded-full font-medium hover:bg-[#1A2E20] transition-colors shadow-[0_4px_14px_0_rgba(44,94,59,0.39)] hover:shadow-[0_6px_20px_rgba(44,94,59,0.23)] hover:-translate-y-0.5 transform duration-200">
              Get Started
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className={`w-6 h-6 ${isScrolled ? "text-[#1A2E20]" : "text-white"}`} />
            ) : (
              <Menu className={`w-6 h-6 ${isScrolled ? "text-[#1A2E20]" : "text-white"}`} />
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-[#1A2E20]">
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/eco-hero-bg.png" 
            alt="Deep green forest motif" 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1A2E20]/80 via-[#2C5E3B]/70 to-[#1A2E20]"></div>
        </div>

        <div className="container mx-auto px-6 md:px-12 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium tracking-wide mb-6 uppercase">
            Join the Movement
          </span>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-8 leading-[1.1]">
            Stop printing.<br />
            <span className="text-[#86EFAC]">Start protecting.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-light">
            Every paper receipt is a choice. Choose the planet. Store, track, and return stress-free with the UK's greenest digital wallet.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto bg-[#86EFAC] text-[#1A2E20] px-8 py-4 rounded-full font-bold text-lg hover:bg-white transition-colors shadow-lg flex items-center justify-center gap-2 group">
              Join the Mission
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto bg-white/10 backdrop-blur-sm text-white border border-white/20 px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-colors">
              Calculate Your Impact
            </button>
          </div>
        </div>
      </section>

      {/* Live Impact Counter Section */}
      <section id="impact" className="py-20 bg-white border-b border-[#E8EAE6]">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">The Receiptify Effect</h2>
            <p className="text-lg text-[#4A5E50]">Together, we're making a measurable difference every single day.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#FAFAF8] p-10 rounded-3xl text-center border border-[#E8EAE6] hover:border-[#2C5E3B]/30 transition-colors group">
              <div className="w-16 h-16 bg-[#2C5E3B]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Receipt className="w-8 h-8 text-[#2C5E3B]" />
              </div>
              <div className="text-5xl font-bold text-[#1A2E20] mb-2 tracking-tighter">
                {receiptsCount.toLocaleString()}
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-[#4A5E50]">Receipts Saved from Landfill</div>
            </div>

            <div className="bg-[#FAFAF8] p-10 rounded-3xl text-center border border-[#E8EAE6] hover:border-[#2C5E3B]/30 transition-colors group">
              <div className="w-16 h-16 bg-[#2C5E3B]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Wind className="w-8 h-8 text-[#2C5E3B]" />
              </div>
              <div className="text-5xl font-bold text-[#1A2E20] mb-2 tracking-tighter">
                12.4t
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-[#4A5E50]">CO₂ Reduced</div>
            </div>

            <div className="bg-[#FAFAF8] p-10 rounded-3xl text-center border border-[#E8EAE6] hover:border-[#2C5E3B]/30 transition-colors group">
              <div className="w-16 h-16 bg-[#2C5E3B]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <TreePine className="w-8 h-8 text-[#2C5E3B]" />
              </div>
              <div className="text-5xl font-bold text-[#1A2E20] mb-2 tracking-tighter">
                206
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-[#4A5E50]">Trees Protected</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features as Tools Section */}
      <section id="features" className="py-24 bg-[#FAFAF8]">
        <div className="container mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Tools for the conscious consumer.</h2>
              <p className="text-xl text-[#4A5E50] mb-10 leading-relaxed">
                We're not just a receipt app. We're your partner in sustainable spending. Our tools are designed to give you clarity on your purchases while reducing your environmental footprint.
              </p>

              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="mt-1 bg-white p-3 rounded-xl shadow-sm border border-[#E8EAE6] h-fit">
                    <Scan className="w-6 h-6 text-[#2C5E3B]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Instant Eco-Scanning</h3>
                    <p className="text-[#4A5E50]">Our AI-powered OCR instantly extracts data from paper receipts so you can recycle them immediately. Or better yet, scan QR codes directly at checkout.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 bg-white p-3 rounded-xl shadow-sm border border-[#E8EAE6] h-fit">
                    <BarChart3 className="w-6 h-6 text-[#2C5E3B]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Personal Impact Tracking</h3>
                    <p className="text-[#4A5E50]">Watch your personal forest grow. Every receipt you save digitally contributes to your individual eco-score and spending analytics.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 bg-white p-3 rounded-xl shadow-sm border border-[#E8EAE6] h-fit">
                    <ShieldCheck className="w-6 h-6 text-[#2C5E3B]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Stress-Free Returns</h3>
                    <p className="text-[#4A5E50]">Never lose a warranty again. We securely store your high-value purchase data so returns and claims are seamless and paperless.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2C5E3B]/20 to-transparent rounded-3xl transform rotate-3"></div>
              <img 
                src="/__mockup/images/eco-impact-feature.png" 
                alt="Eco-friendly concept illustration" 
                className="relative rounded-3xl shadow-2xl object-cover aspect-[4/3] w-full border border-white/20"
              />
              
              {/* Floating UI Element */}
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-[#E8EAE6] max-w-[240px]">
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-5 h-5 text-[#2C5E3B]" />
                  <span className="font-bold text-sm">Your Impact</span>
                </div>
                <div className="text-2xl font-bold text-[#1A2E20]">42 g</div>
                <div className="text-xs text-[#4A5E50]">CO₂ saved this month</div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2C5E3B] w-[70%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="mission" className="py-24 bg-[#1A2E20] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="container mx-auto px-6 md:px-12 relative z-10 text-center max-w-4xl">
          <Leaf className="w-12 h-12 text-[#86EFAC] mx-auto mb-8" />
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Ready to make a difference?</h2>
          <p className="text-xl text-white/80 mb-10 font-light">
            Join thousands of UK consumers who have already said goodbye to toxic thermal paper. Your wallet—and the planet—will thank you.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="bg-[#86EFAC] text-[#1A2E20] px-8 py-4 rounded-full font-bold text-lg hover:bg-white transition-colors shadow-lg">
              Create Free Account
            </button>
          </div>
          <p className="mt-6 text-sm text-white/50">No credit card required. Free for personal use forever.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-[#E8EAE6]">
        <div className="container mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-[#2C5E3B] text-white p-1.5 rounded-md">
              <Leaf className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-[#1A2E20]">Receiptify</span>
          </div>
          <div className="text-[#4A5E50] text-sm">
            © {new Date().getFullYear()} Receiptify UK. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm font-medium text-[#4A5E50]">
            <a href="#" className="hover:text-[#2C5E3B]">Privacy</a>
            <a href="#" className="hover:text-[#2C5E3B]">Terms</a>
            <a href="#" className="hover:text-[#2C5E3B]">Mission</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
