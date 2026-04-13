import React from "react";
import { 
  ArrowRight, 
  BarChart3, 
  Camera, 
  ChevronRight, 
  Leaf, 
  LineChart, 
  Mail, 
  PieChart, 
  QrCode, 
  Receipt, 
  ShieldCheck, 
  Smartphone, 
  TrendingUp,
  Wallet
} from "lucide-react";

// Fake Data for visualisations
const spendingData = [
  { category: "Groceries", amount: 342, color: "#16a34a", percentage: 43 }, // green-600
  { category: "Shopping", amount: 203, color: "#2563eb", percentage: 26 }, // blue-600
  { category: "Dining", amount: 156, color: "#f59e0b", percentage: 20 }, // amber-500
  { category: "Transport", amount: 89, color: "#8b5cf6", percentage: 11 }, // violet-500
];

const recentTransactions = [
  { merchant: "Tesco Extra", date: "Today", amount: 45.20, category: "Groceries", icon: Wallet },
  { merchant: "TfL Underground", date: "Yesterday", amount: 8.50, category: "Transport", icon: Smartphone },
  { merchant: "Pret A Manger", date: "12 Aug", amount: 12.40, category: "Dining", icon: Wallet },
  { merchant: "Amazon UK", date: "10 Aug", amount: 89.99, category: "Shopping", icon: Wallet },
];

function DonutChart() {
  // SVG Donut Chart implementation
  let cumulativePercent = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="-1 -1 2 2" style={{ transform: "rotate(-90deg)" }} className="w-full h-full">
        {spendingData.map((slice, i) => {
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent / 100);
          cumulativePercent += slice.percentage;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent / 100);
          const largeArcFlag = slice.percentage > 50 ? 1 : 0;
          const pathData = [
            `M ${startX} ${startY}`,
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          ].join(" ");

          return (
            <path
              key={i}
              d={pathData}
              fill="none"
              stroke={slice.color}
              strokeWidth="0.4"
              className="transition-all duration-500 hover:stroke-[0.45] cursor-pointer"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-sm text-slate-500 font-medium">Total Spend</span>
        <span className="text-2xl font-bold text-slate-900">£790</span>
      </div>
    </div>
  );
}

function BarChart() {
  const maxAmount = Math.max(...spendingData.map(d => d.amount));
  
  return (
    <div className="flex items-end justify-between h-40 gap-2 mt-6">
      {spendingData.map((item, i) => {
        const height = `${(item.amount / maxAmount) * 100}%`;
        return (
          <div key={i} className="flex flex-col items-center flex-1 gap-2 group">
            <div className="w-full relative rounded-t-sm flex-1 flex items-end bg-slate-100 dark:bg-slate-800">
              <div 
                className="w-full rounded-t-sm transition-all duration-500" 
                style={{ height, backgroundColor: item.color }}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap transition-opacity">
                  £{item.amount}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium truncate w-full text-center">{item.category}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FinanceControl() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-green-100 selection:text-green-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Receiptify</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#analytics" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Analytics</a>
            <a href="#security" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Sign In
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-green-600/20">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium mb-6">
              <TrendingUp className="w-4 h-4" />
              <span>Smarter spending starts here</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
              Know exactly where <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">
                your money goes.
              </span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-xl">
              Turn your scattered receipts into clear financial insights. Receiptify automatically categorises your spending, tracks warranties, and helps you make better money decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-xl text-base font-medium transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2">
                Start Tracking Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl text-base font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
                See How It Works
              </button>
            </div>
            
            <div className="mt-10 flex items-center gap-4 text-sm text-slate-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-50 bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 z-[${5-i}]`}>
                    {String.fromCharCode(64+i)}
                  </div>
                ))}
              </div>
              <p>Trusted by 10,000+ UK budgeters</p>
            </div>
          </div>

          {/* Hero Dashboard Preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {/* Decorative background blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-green-100/40 via-blue-50/40 to-emerald-50/40 rounded-full blur-3xl -z-10"></div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col relative z-10 transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-slate-900">Monthly Overview</h3>
                  <p className="text-sm text-slate-500">August 2023</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              
              <div className="p-6">
                <DonutChart />
                
                <div className="mt-8 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Categories</h4>
                  {spendingData.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm font-medium text-slate-700">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-900">£{item.amount}</span>
                        <span className="text-xs text-slate-500 w-8 text-right">{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Widget */}
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 w-64 transform lg:-rotate-3 hover:rotate-0 transition-transform duration-500 z-20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Eco Impact</p>
                  <p className="text-sm font-bold text-slate-900">42 trees saved</p>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Feature Section */}
      <section id="analytics" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Financial clarity, automatically.</h2>
            <p className="text-lg text-slate-600">Stop guessing where your money went. Every scanned receipt instantly updates your financial dashboard.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Category Breakdown</h3>
              <p className="text-slate-600">AI automatically assigns categories to every item on your receipt, giving you granular insights into your spending habits.</p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-6">
                <LineChart className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Monthly Trends</h3>
              <p className="text-slate-600">Compare your spending month over month. Set budgets for specific categories and get alerts when you're getting close.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-6">
                <Wallet className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Tax & Returns Prep</h3>
              <p className="text-slate-600">Easily export expense reports for tax season. Never lose a warranty or return window again with automated tracking.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Capture Methods Section */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Connect all your receipts, effortlessly.</h2>
              <p className="text-lg text-slate-600 mb-8">We've built multiple ways to get your data into Receiptify, so you never have to manually enter an expense again.</p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Smart Camera Scan</h4>
                    <p className="text-slate-600 mt-1">Snap a photo. Our OCR reads the merchant, date, total, and individual items instantly.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Email Forwarding</h4>
                    <p className="text-slate-600 mt-1">Forward e-receipts to your unique @receiptify.me address. We'll parse them automatically.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">QR Code Connect</h4>
                    <p className="text-slate-600 mt-1">Scan at partner retailers in the UK to receive digital receipts directly into the app.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
              <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center justify-between">
                Recent Transactions
                <button className="text-sm text-green-600 font-medium hover:text-green-700">View All</button>
              </h3>
              
              <div className="space-y-6">
                {recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors -mx-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <tx.icon className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tx.merchant}</p>
                        <p className="text-xs text-slate-500">{tx.category} • {tx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">£{tx.amount.toFixed(2)}</p>
                      <button className="text-xs text-slate-400 hover:text-slate-600 mt-1">View Receipt</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-navy-900 bg-slate-900 text-white relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-green-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">See your spending clearly.</h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join thousands of UK consumers who have taken control of their finances with Receiptify. Bank-grade security, perfectly organised.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl text-lg font-bold transition-colors shadow-lg shadow-green-500/20">
              Sign Up for Free
            </button>
          </div>
          <p className="mt-6 text-sm text-slate-400">No credit card required. iOS and Android apps available.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-600 flex items-center justify-center">
              <Receipt className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">Receiptify</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#" className="hover:text-slate-900">Security</a>
            <a href="#" className="hover:text-slate-900">Contact</a>
          </div>
          <p className="text-sm text-slate-400">© 2024 Receiptify UK. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
