import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, QrCode, Smartphone, TrendingUp, Users, ShieldCheck, Zap, Database, Cpu, Terminal } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll(".tech-card"));
    function onMove(e: Event) {
      const mouseEvent = e as MouseEvent;
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const x = (mouseEvent.clientX - r.left) / r.width - 0.5;
      const y = (mouseEvent.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateX(${-y * 4}deg) rotateY(${x * 6}deg) translateY(-2px)`;
    }
    function onLeave(e: Event) {
      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
    }
    cards.forEach(el => {
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
    });
    return () => {
      cards.forEach(el => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      });
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap');
        
        :root{ 
          --bg: #0b0f14; 
          --card: #0f141b; 
          --accent: #00E5FF; 
          --ring: rgba(0,229,255,.35); 
        }
        .tech-bg { 
          background: radial-gradient(1200px 600px at 70% -10%, rgba(0,229,255,.08), transparent 40%), var(--bg); 
          color: #e6eef6; 
          font-family: Inter, system-ui, sans-serif; 
        }
        .grid-bg::before{ 
          content:""; 
          position:fixed; 
          inset:0; 
          pointer-events:none; 
          background: linear-gradient(rgba(255,255,255,.04), rgba(255,255,255,.02)), repeating-linear-gradient(0deg, transparent 0 24px, rgba(255,255,255,.035) 24px 25px), repeating-linear-gradient(90deg, transparent 0 24px, rgba(255,255,255,.035) 24px 25px); 
          mask: linear-gradient(180deg, rgba(0,0,0,.9), transparent 60%); 
        }
        .tech-card{ 
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)); 
          border:1px solid rgba(255,255,255,.08); 
          border-radius:18px; 
          backdrop-filter:saturate(120%) blur(8px); 
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; 
        }
        .tech-card:hover{ 
          box-shadow:0 0 0 1px var(--ring), 0 0 40px rgba(0,229,255,.10); 
          transform: translateY(-2px); 
        }
        .scanline{ 
          position:fixed; 
          inset:0; 
          pointer-events:none; 
          background: repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px); 
          mix-blend-mode: overlay; 
          opacity:.35; 
        }
        .glow-text{ 
          text-shadow: 0 0 18px rgba(0,229,255,.25); 
        }
        .accent-text { 
          color: var(--accent); 
        }
        .tech-button {
          background: var(--accent);
          color: #000;
          box-shadow: 0 0 0 1px var(--ring), 0 0 30px rgba(0,229,255,.18);
          border: none;
        }
        .tech-button:hover {
          filter: brightness(110%);
          color: #000;
        }
        .tech-button-outline {
          background: transparent;
          border: 1px solid rgba(255,255,255,.3);
          color: #e6eef6;
        }
        .tech-button-outline:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: transparent;
        }
        pre, code { 
          font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace; 
          color: #bfefff; 
        }
        .tech-logo {
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
          border: 1px solid rgba(255,255,255,.08);
          box-shadow: 0 0 0 1px var(--ring), 0 0 30px rgba(0,229,255,.18);
        }
        .mono-text {
          font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;
        }
        .stats-glow {
          background: radial-gradient(circle at center, rgba(0,229,255,.15), transparent 50%);
        }
      `}</style>
      
      <div className="min-h-screen tech-bg grid-bg relative" data-testid="landing-page">
        <div className="scanline" aria-hidden="true"></div>
        
        {/* Header */}
        <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between" data-testid="navigation">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl tech-card tech-logo flex items-center justify-center">
              <span className="mono-text accent-text text-lg font-bold">{'> /'}</span>
            </div>
            <div>
              <span className="font-semibold tracking-wide text-lg">Receiptify</span>
              <p className="text-xs text-gray-400 mono-text">OneTap Receipts. Zero Paper.</p>
            </div>
          </div>
          <div className="hidden md:flex gap-6 text-sm opacity-90">
            <a href="#features" className="hover:text-accent transition" data-testid="link-features">Features</a>
            <a href="#stats" className="hover:text-accent transition" data-testid="link-stats">Stats</a>
            <a href="#tech" className="hover:text-accent transition" data-testid="link-tech">Tech</a>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <Button className="tech-button-outline" data-testid="button-signin">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="tech-button" data-testid="button-get-started">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-6 py-20" data-testid="hero-section">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs tracking-wider border border-slate-700/60 mono-text accent-text">
                BETA ACCESS
              </span>
              <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-tight glow-text">
                Build your receipt <span className="accent-text">ecosystem</span> with AI
              </h1>
              <p className="mt-4 text-slate-400 max-w-lg text-lg leading-relaxed">
                Neural receipt processing, blockchain verification, quantum encryption. 
                Experience the future of digital receipts.
              </p>
              <div className="mt-8 flex gap-4">
                <Link href="/signup">
                  <Button className="tech-button px-6 py-3 font-semibold" data-testid="button-start-neural">
                    Initialize System
                  </Button>
                </Link>
                <Button className="tech-button-outline px-6 py-3" data-testid="button-live-demo">
                  <Terminal className="w-4 h-4 mr-2" />
                  Live Demo
                </Button>
              </div>
            </div>

            <div className="tech-card p-6 relative overflow-hidden" data-testid="code-preview">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl opacity-40 accent-text"
                   style={{background: 'radial-gradient(circle at center, var(--accent), transparent 60%)'}}></div>
              <pre className="text-xs md:text-sm mono-text leading-6">
{`// Neural Receipt API v2.1
{
  "status": "online",
  "neural_latency_ms": 12,
  "blockchain_height": 847392,
  "receipts_processed": 2847392,
  "ai_confidence": 98.7,
  "quantum_encrypted": true
}`}
              </pre>
            </div>
          </div>
        </main>

        {/* Features Section */}
        <section id="features" className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6" data-testid="features-section">
          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">Neural QR Processing</h3>
            </div>
            <p className="text-sm text-slate-400">AI-powered receipt scanning with 99.8% accuracy. Quantum-encrypted data extraction.</p>
          </div>
          
          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">Blockchain Verification</h3>
            </div>
            <p className="text-sm text-slate-400">Immutable receipt storage on distributed ledger. Cryptographic proof of purchase.</p>
          </div>
          
          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">Edge Computing</h3>
            </div>
            <p className="text-sm text-slate-400">Real-time processing at the edge. Sub-millisecond response times globally.</p>
          </div>

          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">ML Analytics</h3>
            </div>
            <p className="text-sm text-slate-400">Predictive spending models. Neural network expense classification.</p>
          </div>

          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">Distributed Splitting</h3>
            </div>
            <p className="text-sm text-slate-400">P2P bill splitting protocol. Zero-knowledge payment verification.</p>
          </div>

          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Leaf className="w-6 h-6 accent-text" />
              <h3 className="font-semibold">Carbon Footprint AI</h3>
            </div>
            <p className="text-sm text-slate-400">Real-time environmental impact calculation using satellite data feeds.</p>
          </div>
        </section>

        {/* Stats Section */}
        <section id="stats" className="max-w-4xl mx-auto px-6 py-16 text-center stats-glow rounded-3xl mb-24" data-testid="stats-section">
          <h3 className="text-3xl font-bold mb-12 glow-text">Neural Network Performance</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="tech-card p-8">
              <div className="text-4xl font-bold mb-2 accent-text mono-text">847.3K</div>
              <div className="text-slate-400 mono-text text-sm">Receipts Processed</div>
              <div className="text-xs text-slate-500 mt-1">+23.4% quantum efficiency</div>
            </div>
            <div className="tech-card p-8">
              <div className="text-4xl font-bold mb-2 accent-text mono-text">99.87%</div>
              <div className="text-slate-400 mono-text text-sm">AI Accuracy</div>
              <div className="text-xs text-slate-500 mt-1">Neural model v4.2.1</div>
            </div>
            <div className="tech-card p-8">
              <div className="text-4xl font-bold mb-2 accent-text mono-text">12ms</div>
              <div className="text-slate-400 mono-text text-sm">Avg Latency</div>
              <div className="text-xs text-slate-500 mt-1">Edge processing</div>
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section id="tech" className="max-w-6xl mx-auto px-6 py-16 text-center mb-24" data-testid="tech-section">
          <h3 className="text-3xl font-bold mb-12 glow-text">Built on Cutting-Edge Tech</h3>
          <div className="tech-card p-8 relative overflow-hidden">
            <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full blur-3xl opacity-20 accent-text"
                 style={{background: 'radial-gradient(circle at center, var(--accent), transparent 60%)'}}></div>
            <pre className="text-left mono-text text-sm leading-7 max-w-4xl mx-auto">
{`// System Architecture
const receiptSystem = {
  frontend: ['React', 'TypeScript', 'TailwindCSS'],
  backend: ['Node.js', 'Express', 'Drizzle ORM'],
  ai: ['TensorFlow', 'OpenCV', 'Tesseract.js'],
  blockchain: ['Ethereum', 'IPFS', 'Web3'],
  database: ['PostgreSQL', 'Redis', 'Neo4j'],
  security: ['Zero-Knowledge Proofs', 'AES-256', 'OAuth2'],
  deployment: ['Docker', 'Kubernetes', 'AWS Lambda']
};

// Processing Pipeline
async function processReceipt(image) {
  const extracted = await neuralOCR.scan(image);
  const verified = await blockchain.verify(extracted);
  const stored = await quantumDB.store(verified);
  return { confidence: 99.87, hash: stored.hash };
}`}
            </pre>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center" data-testid="cta-section">
          <h3 className="text-3xl font-bold mb-6 glow-text">
            Ready to initialize your receipt ecosystem?
          </h3>
          <p className="text-xl text-slate-400 mb-8">
            Join the neural network. Process receipts at quantum speed. 
            Experience the future of digital transactions.
          </p>
          <Link href="/signup">
            <Button className="tech-button px-12 py-4 text-lg font-semibold" data-testid="button-initialize">
              Initialize Neural Network
            </Button>
          </Link>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-slate-800" data-testid="footer">
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-lg tech-logo flex items-center justify-center">
                <span className="mono-text accent-text text-sm">{'>'}</span>
              </div>
              <span className="text-xl font-bold">Receiptify</span>
            </div>
            <p className="text-gray-500 mono-text text-sm">Neural Receipt Processing © 2025 | Quantum Encrypted</p>
            <div className="mt-4 flex justify-center gap-6 text-xs text-slate-500">
              <a href="#" className="hover:text-accent transition">System Status</a>
              <a href="#" className="hover:text-accent transition">API Docs</a>
              <a href="#" className="hover:text-accent transition">Neural Models</a>
              <a href="#" className="hover:text-accent transition">Blockchain Explorer</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}