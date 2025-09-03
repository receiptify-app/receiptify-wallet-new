import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Menu, Leaf, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";

// Sample data to match the design
const spendingData = [
  { category: "Food", amount: 17.20, color: "#4CAF50" },
  { category: "Tech", amount: 1.99, color: "#FFC107" },
  { category: "Transport", amount: 103.00, color: "#9C27B0" }
];

const recentActivity = [
  {
    id: "1",
    merchant: "Waitrose",
    logo: "W", // Placeholder for Waitrose logo
    amount: "12.02",
    date: "12 July 2025",
    color: "#1B5E20"
  },
  {
    id: "2", 
    merchant: "Argos",
    logo: "A", // Placeholder for Argos logo
    amount: "59.99",
    date: "25 June 2025", 
    color: "#D32F2F"
  },
  {
    id: "3",
    merchant: "Shell", 
    logo: "🛢️", // Shell icon
    amount: "23.80",
    date: "22 June 2025",
    color: "#FF9800"
  }
];

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState("This month");
  const [, navigate] = useLocation();

  const totalSpending = spendingData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 5px rgba(0,229,255,.3); } 50% { box-shadow: 0 0 20px rgba(0,229,255,.6), 0 0 30px rgba(0,229,255,.4); } }
        @keyframes data-stream { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes circuit { 0% { stroke-dashoffset: 1000; } 100% { stroke-dashoffset: 0; } }
        
        .tech-bg { 
          background: 
            radial-gradient(ellipse at top, rgba(0,229,255,.15), transparent 50%),
            radial-gradient(ellipse at bottom, rgba(138,43,226,.1), transparent 50%),
            linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
          color: #e6eef6; 
          position: relative;
          overflow-x: hidden;
        }
        
        .floating-particles::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(2px 2px at 20% 30%, #00E5FF, transparent),
            radial-gradient(2px 2px at 40% 70%, rgba(138,43,226,.8), transparent),
            radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,.8), transparent),
            radial-gradient(1px 1px at 50% 50%, #00E5FF, transparent);
          animation: float 6s ease-in-out infinite;
          pointer-events: none;
          z-index: 1;
        }
        
        .grid-bg::before{ 
          content:""; 
          position:fixed; 
          inset:0; 
          pointer-events:none; 
          background: 
            linear-gradient(rgba(0,229,255,.03), rgba(0,229,255,.01)), 
            repeating-linear-gradient(0deg, transparent 0 40px, rgba(0,229,255,.05) 40px 41px), 
            repeating-linear-gradient(90deg, transparent 0 40px, rgba(0,229,255,.05) 40px 41px); 
          mask: linear-gradient(180deg, rgba(0,0,0,.8), transparent 70%); 
          z-index: 0;
        }
        
        .tech-card{ 
          background: linear-gradient(135deg, rgba(0,229,255,.08) 0%, rgba(255,255,255,.02) 50%, rgba(138,43,226,.04) 100%); 
          border: 1px solid transparent;
          background-clip: padding-box;
          backdrop-filter: saturate(120%) blur(20px); 
          transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); 
          position: relative;
          overflow: hidden;
          z-index: 2;
        }
        
        .tech-card::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          background: linear-gradient(45deg, transparent, rgba(0,229,255,.3), transparent);
          border-radius: inherit;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          opacity: 0;
          transition: opacity .3s ease;
        }
        
        .tech-card:hover::before { opacity: 1; }
        .tech-card:hover{ 
          box-shadow: 
            0 0 0 1px rgba(0,229,255,.4), 
            0 8px 32px rgba(0,229,255,.15),
            inset 0 1px 0 rgba(255,255,255,.1); 
          transform: translateY(-8px) scale(1.02); 
          background: linear-gradient(135deg, rgba(0,229,255,.12) 0%, rgba(255,255,255,.04) 50%, rgba(138,43,226,.08) 100%);
        }
        
        .cyber-border {
          position: relative;
        }
        .cyber-border::before {
          content: '';
          position: absolute;
          inset: -2px;
          background: linear-gradient(45deg, #00E5FF, transparent, #8A2BE2, transparent, #00E5FF);
          border-radius: inherit;
          animation: circuit 3s linear infinite;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
        }
        
        .accent-text { 
          color: #00E5FF; 
          background: linear-gradient(135deg, #00E5FF 0%, #40E0D0 50%, #00E5FF 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .glow-text { 
          text-shadow: 
            0 0 10px rgba(0,229,255,.5),
            0 0 20px rgba(0,229,255,.3),
            0 0 40px rgba(0,229,255,.1); 
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .mono-text { 
          font-family: 'Courier New', 'SF Mono', 'Monaco', monospace; 
          letter-spacing: 0.05em;
        }
        
        .holographic {
          background: linear-gradient(45deg, 
            rgba(0,229,255,.1) 0%, 
            rgba(138,43,226,.1) 25%, 
            rgba(0,229,255,.1) 50%, 
            rgba(255,20,147,.1) 75%, 
            rgba(0,229,255,.1) 100%);
          background-size: 200% 200%;
          animation: holographic 4s ease infinite;
        }
        
        @keyframes holographic {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .data-visualization {
          position: relative;
          overflow: hidden;
        }
        .data-visualization::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,.1), transparent);
          animation: data-stream 3s ease-in-out infinite;
        }

        .geometric-pattern {
          background-image: 
            radial-gradient(circle at 1px 1px, rgba(0,229,255,.15) 1px, transparent 0);
          background-size: 20px 20px;
          position: relative;
        }

        .geometric-pattern::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            linear-gradient(45deg, transparent 40%, rgba(138,43,226,.1) 50%, transparent 60%),
            linear-gradient(-45deg, transparent 40%, rgba(0,229,255,.1) 50%, transparent 60%);
          background-size: 40px 40px;
          animation: geometric-shift 8s linear infinite;
        }

        @keyframes geometric-shift {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 40px 40px, -40px 40px; }
        }

        .neon-pulse {
          animation: neon-pulse 2s ease-in-out infinite alternate;
        }

        @keyframes neon-pulse {
          from {
            text-shadow: 
              0 0 5px rgba(0,229,255,.8),
              0 0 10px rgba(0,229,255,.8),
              0 0 15px rgba(0,229,255,.8),
              0 0 20px rgba(0,229,255,.8);
          }
          to {
            text-shadow: 
              0 0 2px rgba(0,229,255,.8),
              0 0 5px rgba(0,229,255,.8),
              0 0 8px rgba(0,229,255,.8),
              0 0 12px rgba(0,229,255,.8);
          }
        }
      `}</style>
      <div className="min-h-screen tech-bg grid-bg floating-particles geometric-pattern pb-24 relative">
        <AppHeader />

        <div className="px-6 py-4 space-y-6">
          {/* Spending Summary */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-accent-text">
                {selectedPeriod}
                <ChevronDown className="h-4 w-4" />
              </Button>
              <h2 className="text-4xl font-bold accent-text glow-text mono-text cyber-border">£{totalSpending.toFixed(0)}</h2>
            </div>
          </div>

          {/* Spending Chart Card */}
          <Card className="tech-card shadow-lg border-0 holographic data-visualization">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-6">
                {/* Enhanced donut chart with glow effects */}
                <div className="relative w-32 h-32" style={{filter: 'drop-shadow(0 0 20px rgba(0,229,255,0.3))'}}>
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                    />
                    {/* Food segment - largest */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#4CAF50"
                      strokeWidth="10"
                      strokeDasharray={`${(17.20/122.19) * 251.33} 251.33`}
                      strokeDashoffset="0"
                    />
                    {/* Transport segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#9C27B0"
                      strokeWidth="10"
                      strokeDasharray={`${(103.00/122.19) * 251.33} 251.33`}
                      strokeDashoffset={`-${(17.20/122.19) * 251.33}`}
                    />
                    {/* Tech segment - smallest */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#FFC107"
                      strokeWidth="10"
                      strokeDasharray={`${(1.99/122.19) * 251.33} 251.33`}
                      strokeDashoffset={`-${((17.20+103.00)/122.19) * 251.33}`}
                    />
                  </svg>
                </div>
              </div>
              
              {/* Category breakdown */}
              <div className="space-y-3">
                {spendingData.map((item) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-300 font-medium">{item.category}</span>
                    </div>
                    <span className="font-semibold accent-text">£{item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-3">
            <Card className="tech-card shadow-sm cursor-pointer cyber-border" onClick={() => navigate('/eco')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg" style={{boxShadow: '0 0 20px rgba(34,197,94,0.4)'}}>
                      <Leaf className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300 font-medium">Eco Points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold accent-text">40</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="tech-card shadow-sm cursor-pointer holographic" onClick={() => navigate('/cards')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg" style={{boxShadow: '0 0 20px rgba(0,229,255,0.4)'}}>
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300 font-medium">Loyalty usage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold accent-text">6x uses</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-xl font-bold text-gray-300 mb-4 neon-pulse">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <Card key={activity.id} className="tech-card shadow-sm cursor-pointer data-visualization" onClick={() => navigate('/receipt/1')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg"
                          style={{ 
                            backgroundColor: activity.color,
                            boxShadow: `0 0 20px ${activity.color}40`
                          }}
                        >
                          {activity.logo}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-300">{activity.merchant}</h4>
                          <p className="text-sm text-gray-400">{activity.date}</p>
                        </div>
                      </div>
                      <span className="font-bold accent-text">£{activity.amount}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}