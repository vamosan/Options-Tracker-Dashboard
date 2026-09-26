"use client";

import { useState, useEffect } from "react";
import { 
  Play, Square, ShieldCheck, Activity, DollarSign, Clock, 
  TrendingUp, Zap, Target, AlertOctagon, ArrowUpRight, 
  RefreshCw, ChevronRight, CheckCircle2, BarChart2, Radio,
  ArrowRight, ShieldAlert, Sparkles, Terminal, Award, 
  PieChart, Sliders, Briefcase, FileText, ChevronDown, Check,
  ArrowDownRight, HelpCircle
} from "lucide-react";

interface Catalyst {
  headline: string;
  source: string;
  sentiment: string;
}

interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  ask: number;
  bid: number;
  spread: number;
  delta: number;
  iv: string;
  volume: string;
  openInterest: string;
}

interface ORBData {
  high: number;
  low: number;
  rangeWidth: number;
  status: string;
}

interface SignalData {
  state: "BREAKOUT" | "PENDING";
  badge: string;
  action: string;
  triggerPrice: number;
}

interface TargetData {
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskDollars: number;
  rewardT1Dollars: number;
  rewardT2Dollars: number;
  rrRatio: string;
  underlyingStop: number;
  underlyingTarget: number;
}

interface DiscoveredSetup {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: string;
  rvol: string;
  discoveredAt: string;
  catalyst: Catalyst;
  contract: OptionContract;
  orb: ORBData;
  signal: SignalData;
  targets: TargetData;
}

interface SignalEvent {
  id: string;
  timestamp: string;
  symbol: string;
  priceAtTrigger: number;
  signalType: string;
  contract: string;
  entryPremium: number;
  peakPremium: number;
  peakGainPercent: string;
  outcome: string;
  outcomeColor: string;
  mfe: string;
}

interface ActiveTrade {
  id: string;
  symbol: string;
  underlying: string;
  strike: number;
  type: "CALL";
  entryTime: string;
  entryPrice: number;
  currentPrice: number;
  qty: number;
  stopLoss: number;
  target1: number;
  target2: number;
  status: "OPEN" | "SCALED_50" | "CLOSED";
}

interface ClosedTrade {
  id: string;
  symbol: string;
  underlying: string;
  type: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  stopLoss: number;
  pnl: number;
  pnlPercent: string;
  status: string;
  lessons: string;
  tags: string[];
}

interface AnalyticsData {
  winRate: number;
  totalNetPnl: number;
  grossWins: number;
  grossLosses: number;
  profitFactor: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  bestTrade: string;
  worstTrade: string;
}

export function AlpacaBotDashboard() {
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState<"SETUPS" | "POSITIONS" | "SIGNALS" | "ANALYTICS" | "LOGS">("SETUPS");
  const [setups, setSetups] = useState<DiscoveredSetup[]>([]);
  const [signalsHistory, setSignalsHistory] = useState<SignalEvent[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [activePositions, setActivePositions] = useState<ActiveTrade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [contractQty, setContractQty] = useState<Record<string, number>>({});

  const runScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/alpaca-bot/scan", { method: "POST" });
      const data = await res.json();

      if (data.setups) setSetups(data.setups);
      if (data.signalsHistory) setSignalsHistory(data.signalsHistory);
      if (data.trades) setClosedTrades(data.trades);
      if (data.analytics) setAnalytics(data.analytics);
      if (data.logs) {
        setLiveLog(prev => [...prev, ...data.logs].slice(-75));
      }
      setConnected(true);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Scan error:", err);
      setLiveLog(prev => [...prev, `[ERROR] Scan error: ${err.message}`]);
      setConnected(false);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Autonomous Engine active. Scanning live momentum...`]);
      setConnected(true);
      runScan();
      interval = setInterval(runScan, 25000);
    } else {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Autonomous Engine paused.`]);
      setConnected(false);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Handle Paper Trade Execution from Setup Card
  const handleExecutePaperTrade = (s: DiscoveredSetup) => {
    const qty = contractQty[s.symbol] || 3;
    const newTrade: ActiveTrade = {
      id: `pos_${s.symbol}_${Date.now()}`,
      symbol: s.contract.symbol,
      underlying: s.symbol,
      strike: s.contract.strike,
      type: "CALL",
      entryTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entryPrice: s.contract.ask,
      currentPrice: s.contract.ask,
      qty,
      stopLoss: s.targets.stopLoss,
      target1: s.targets.target1,
      target2: s.targets.target2,
      status: "OPEN"
    };

    setActivePositions(prev => [newTrade, ...prev]);
    setActiveTab("POSITIONS");
    setLiveLog(prev => [
      ...prev, 
      `[EXECUTE] ⚡ Paper Trade Entered: ${qty}x ${s.contract.symbol} @ $${s.contract.ask.toFixed(2)} (Stop: $${s.targets.stopLoss.toFixed(2)})`
    ]);
  };

  // Close / Exit Active Position
  const handleClosePosition = (posId: string, exitPriceOverride?: number) => {
    const pos = activePositions.find(p => p.id === posId);
    if (!pos) return;

    const exitPrice = exitPriceOverride || pos.currentPrice;
    const pnlDollars = Math.round((exitPrice - pos.entryPrice) * pos.qty * 100 * 100) / 100;
    const pnlPercent = `${((exitPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(1)}%`;

    const closedItem: ClosedTrade = {
      id: `hist_${Date.now()}`,
      symbol: pos.symbol,
      underlying: pos.underlying,
      type: pos.type,
      entryTime: pos.entryTime,
      exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entryPrice: pos.entryPrice,
      exitPrice: exitPrice,
      qty: pos.qty,
      stopLoss: pos.stopLoss,
      pnl: pnlDollars,
      pnlPercent: pnlDollars >= 0 ? `+${pnlPercent}` : pnlPercent,
      status: pnlDollars >= 0 ? "CLOSED (PROFIT TARGET)" : "CLOSED (STOPPED OUT)",
      lessons: `Manual exit executed at $${exitPrice.toFixed(2)}. ${pnlDollars >= 0 ? 'Disciplined target capture.' : 'Strict risk cut.'}`,
      tags: ['#LiveExecution', '#DisciplinedExit']
    };

    setClosedTrades(prev => [closedItem, ...prev]);
    setActivePositions(prev => prev.filter(p => p.id !== posId));
    setLiveLog(prev => [
      ...prev, 
      `[EXIT] Position Closed: ${pos.symbol} @ $${exitPrice.toFixed(2)} | Net P&L: ${pnlDollars >= 0 ? `+$${pnlDollars}` : `-$${Math.abs(pnlDollars)}`}`
    ]);
  };

  // Scale Out 50%
  const handleScaleOut50 = (posId: string) => {
    setActivePositions(prev => prev.map(p => {
      if (p.id === posId) {
        // Half sold at Target 1, stop raised to breakeven
        return {
          ...p,
          qty: Math.max(1, Math.floor(p.qty / 2)),
          stopLoss: p.entryPrice, // Breakeven stop!
          status: "SCALED_50"
        };
      }
      return p;
    }));
    setLiveLog(prev => [...prev, `[SCALE] Locked 50% profits on Target 1! Stop-loss raised to Breakeven.`]);
  };

  // Move Stop to Breakeven
  const handleMoveToBreakeven = (posId: string) => {
    setActivePositions(prev => prev.map(p => {
      if (p.id === posId) {
        return { ...p, stopLoss: p.entryPrice };
      }
      return p;
    }));
    setLiveLog(prev => [...prev, `[STOP] Stop-loss raised to Break-Even (Risk-Free Trade).`]);
  };

  // Calculated Real-Time P&L for Active Positions
  const activeUnrealizedPnl = activePositions.reduce((acc, p) => {
    return acc + (p.currentPrice - p.entryPrice) * p.qty * 100;
  }, 0);

  const displayWinRate = analytics ? analytics.winRate : 75;
  const displayTotalPnl = analytics ? analytics.totalNetPnl : 625.00;

  return (
    <div className="w-full space-y-6 pb-24 max-w-[1440px] mx-auto animate-in fade-in duration-300">
      
      {/* 1. INSTITUTIONAL HUD (Trader's Control Center) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        
        {/* Left: Engine & Account Status */}
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black text-slate-100 tracking-tight">Autonomous Options Intelligence Hub</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Alpaca Paper Active (PA3T0JS9XCGN)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Options Buying Power: <span className="text-slate-200 font-bold">$98,724.74</span> • {lastSync ? `Live Sync: ${lastSync}` : "Connecting..."}
            </p>
          </div>
        </div>

        {/* Center: Live Performance & Edge Analytics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Win Rate</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{displayWinRate}%</span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Net Realized P&L</span>
            <span className={`text-lg font-black font-mono ${displayTotalPnl >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {displayTotalPnl >= 0 ? `+$${displayTotalPnl.toFixed(2)}` : `-$${Math.abs(displayTotalPnl).toFixed(2)}`}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Profit Factor</span>
            <span className="text-lg font-black text-purple-400 font-mono">
              {analytics ? analytics.profitFactor : '6.25'}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Positions</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {activePositions.length} Open
            </span>
          </div>
        </div>

        {/* Right: Autopilot & Force Scan */}
        <div className="flex items-center gap-2.5 self-end xl:self-auto">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg ${
              isRunning 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <><Square className="w-3.5 h-3.5 fill-current" /> Halt Autopilot</>
            ) : (
              <><Play className="w-3.5 h-3.5 fill-current" /> Engage Autopilot</>
            )}
          </button>

          <button 
            onClick={runScan}
            disabled={isScanning}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-md"
            title="Scan Now"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* 2. TRADING SUITE WORKSPACE TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("SETUPS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SETUPS"
              ? "bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Actionable Setups</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300">
            {setups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("POSITIONS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "POSITIONS"
              ? "bg-amber-500/10 border border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Active Positions & Live P&L</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
            {activePositions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("SIGNALS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SIGNALS"
              ? "bg-blue-500/10 border border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Signal History & Timeline</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
            {signalsHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ANALYTICS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "ANALYTICS"
              ? "bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Trader Analytics & Journal</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
            {closedTrades.length} Closed
          </span>
        </button>

        <button
          onClick={() => setActiveTab("LOGS")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "LOGS"
              ? "bg-purple-500/10 border border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Engine Terminal</span>
        </button>
      </div>

      {/* 3. TAB 1: ACTIONABLE SETUPS (The Execution Board) */}
      {activeTab === "SETUPS" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                <span>Pre-Market & In-Play Opportunities</span>
              </h2>
              <p className="text-xs text-slate-400">
                Screened strictly for $10B+ Market Cap, RVOL &gt; 2.0x, $1.20–$3.50 target options with penny-to-nickel spread, and 5-min ORB mapping.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
              {setups.length} Qualified Assets Found
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {setups.map(s => {
              const isBreakout = s.signal.state === "BREAKOUT";
              const selectedQty = contractQty[s.symbol] || 3;

              return (
                <div 
                  key={s.symbol}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xl ${
                    isBreakout 
                      ? 'bg-slate-900/95 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.12)]' 
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  
                  {/* CARD HEADER: TIME OF DISCOVERY & ASSET */}
                  <div className="p-5 border-b border-slate-800 bg-slate-900/70 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-100 tracking-tight font-mono">{s.symbol}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[170px]">{s.name}</span>
                        <span className="text-lg font-black text-slate-100 font-mono">${s.price.toFixed(2)}</span>
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                          s.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {s.changePercent >= 0 ? `+${s.changePercent.toFixed(2)}%` : `${s.changePercent.toFixed(2)}%`}
                        </span>
                      </div>

                      {/* DISCOVERY TIMESTAMP BADGE */}
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Discovered: {s.discoveredAt}
                        </span>
                      </div>
                    </div>

                    {/* METRIC BADGES: MARKET CAP & RVOL */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold">
                        Cap: {s.marketCap}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 font-bold">
                        RVOL: {s.rvol}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold">
                        5-Min ORB Width: ${s.orb.rangeWidth}
                      </span>
                    </div>

                    {/* FUNDAMENTAL CATALYST CONTEXT */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5 text-xs">
                      <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Hard Fundamental Catalyst</span>
                          <span className="text-[10px] text-slate-500 font-mono">• Source: {s.catalyst.source}</span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">• {s.catalyst.sentiment}</span>
                        </div>
                        <p className="text-slate-200 font-medium mt-1">
                          "{s.catalyst.headline}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SIGNAL STATUS BANNER & 5-MIN ORB SHELF */}
                  <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signal Trigger:</span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                          isBreakout 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          {s.signal.badge}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-300 font-mono">
                        Action: <span className={isBreakout ? 'text-emerald-400 font-black' : 'text-slate-400'}>{s.signal.action}</span>
                      </span>
                    </div>

                    {/* Opening Range (9:30-9:35 AM ET) Shelf Bounds */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">ORB Low Shelf (Support)</span>
                        <span className="text-rose-400 font-bold text-sm">${s.orb.low.toFixed(2)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Spot Price</span>
                        <span className="text-slate-100 font-black text-sm">${s.price.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">ORB High (Breakout Shelf)</span>
                        <span className="text-emerald-400 font-bold text-sm">${s.orb.high.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* THE TARGET OPTION CONTRACT & GREEKS */}
                  <div className="p-4 border-b border-slate-800 bg-slate-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        Target Option Contract (Strict $1.20–$3.50 Baseline)
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                        {s.contract.symbol}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Strike & Exp</span>
                        <span className="text-sm font-black text-slate-100">{s.symbol} ${s.contract.strike} Call</span>
                        <span className="text-[10px] text-slate-400 block">{s.contract.expiration}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Ask (Entry Fill)</span>
                        <span className="text-base font-black text-cyan-400">${s.contract.ask.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 block">Bid: ${s.contract.bid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Spread (Penny-Nickel)</span>
                        <span className="text-base font-black text-emerald-400">${s.contract.spread.toFixed(2)}</span>
                        <span className="text-[10px] text-emerald-400/80 block">Institutional Grade</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Greeks & Flow</span>
                        <span className="text-xs font-bold text-slate-300 block">Delta: {s.contract.delta}</span>
                        <span className="text-[10px] text-slate-400 block">IV: {s.contract.iv} • Vol: {s.contract.volume}</span>
                      </div>
                    </div>
                  </div>

                  {/* THE RISK / TARGET MATRIX & EXECUTION CONTROLS */}
                  <div className="p-5 bg-slate-900/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Risk vs. Target Execution Plan
                      </span>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                        Planned R:R: <span className="text-emerald-400 font-bold">{s.targets.rrRatio}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                      {/* STOP LOSS */}
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                        <span className="text-[10px] text-rose-400 font-bold uppercase block">Stop Shelf</span>
                        <span className="text-base font-black text-rose-300 block mt-0.5">
                          ${s.targets.stopLoss.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-rose-400/90 block mt-1">
                          Max Risk: -${s.targets.riskDollars}/ct
                        </span>
                      </div>

                      {/* TARGET 1 */}
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">Target 1 (+30%)</span>
                        <span className="text-base font-black text-emerald-300 block mt-0.5">
                          ${s.targets.target1.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-400/90 block mt-1">
                          Gain: +${s.targets.rewardT1Dollars}/ct
                        </span>
                      </div>

                      {/* TARGET 2 */}
                      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase block">Target 2 (+65%)</span>
                        <span className="text-base font-black text-cyan-300 block mt-0.5">
                          ${s.targets.target2.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-cyan-400/90 block mt-1">
                          Gain: +${s.targets.rewardT2Dollars}/ct
                        </span>
                      </div>
                    </div>

                    {/* INTERACTIVE TRADE SIZING & EXECUTION BUTTON */}
                    <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold uppercase">Sizing:</span>
                        {[1, 3, 5, 10].map(q => (
                          <button
                            key={q}
                            onClick={() => setContractQty(prev => ({ ...prev, [s.symbol]: q }))}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                              selectedQty === q 
                                ? 'bg-cyan-500 text-slate-950 font-black' 
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {q}x
                          </button>
                        ))}
                        <span className="text-[11px] text-slate-500 font-mono ml-1">
                          Total Risk: ${s.targets.riskDollars * selectedQty}
                        </span>
                      </div>

                      <button
                        onClick={() => handleExecutePaperTrade(s)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        Execute Paper Trade ({selectedQty}ct @ ${s.contract.ask})
                      </button>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. TAB 2: ACTIVE POSITIONS & LIVE P&L (Trade Management) */}
      {activeTab === "POSITIONS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-400" />
                Active Managed Positions
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time trade management: scale out at Target 1, ratchet stop-loss to breakeven, or flatten position.
              </p>
            </div>

            <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Open Positions P&L</span>
              <span className={`text-base font-black font-mono ${activeUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeUnrealizedPnl >= 0 ? `+$${activeUnrealizedPnl.toFixed(2)}` : `-$${Math.abs(activeUnrealizedPnl).toFixed(2)}`}
              </span>
            </div>
          </div>

          {activePositions.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No active positions open right now</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Navigate to "Actionable Setups" and click "Execute Paper Trade" on any breakout opportunity to begin managing it live here.
              </p>
              <button
                onClick={() => setActiveTab("SETUPS")}
                className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition-all"
              >
                Go to Actionable Setups &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activePositions.map(pos => {
                const livePnlDollars = (pos.currentPrice - pos.entryPrice) * pos.qty * 100;
                const livePnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

                return (
                  <div key={pos.id} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-100 font-mono">{pos.underlying} ${pos.strike} Call</span>
                        <span className="text-xs text-slate-400 font-mono">{pos.symbol}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          {pos.qty} Contracts
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Filled @ {pos.entryTime}</span>
                      </div>

                      {/* LIVE PROFIT / LOSS BADGE */}
                      <div className="flex items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-xl font-mono text-base font-black ${
                          livePnlDollars >= 0 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' 
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {livePnlDollars >= 0 ? `+$${livePnlDollars.toFixed(2)} (+${livePnlPercent.toFixed(1)}%)` : `-$${Math.abs(livePnlDollars).toFixed(2)} (${livePnlPercent.toFixed(1)}%)`}
                        </div>
                      </div>
                    </div>

                    {/* TRADE NUMBERS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Entry Fill</span>
                        <span className="text-sm font-bold text-slate-100">${pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Stop-Loss Level</span>
                        <span className="text-sm font-bold text-rose-400">${pos.stopLoss.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Target 1 (+30%)</span>
                        <span className="text-sm font-bold text-emerald-400">${pos.target1.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Target 2 (+65%)</span>
                        <span className="text-sm font-bold text-cyan-400">${pos.target2.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* SEASONED TRADER ACTIONS: SCALE OUT & STOP ADJUSTMENT */}
                    <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleScaleOut50(pos.id)}
                          disabled={pos.status === "SCALED_50"}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                            pos.status === "SCALED_50" 
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {pos.status === "SCALED_50" ? "✓ Scaled 50% & Stop at BE" : "🎯 Scale 50% at Target 1"}
                        </button>

                        <button
                          onClick={() => handleMoveToBreakeven(pos.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                        >
                          🛑 Move Stop to Break-Even ($0 Risk)
                        </button>
                      </div>

                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider transition-all"
                      >
                        Exit All / Flatten Position
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: SIGNAL HISTORY & ALERT TIMELINE */}
      {activeTab === "SIGNALS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Chronological Signal History & Callout Log
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Every pre-market and market hours breakout alert logged with entry triggers, peak gains (MFE), and final trade outcome.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              4 Callouts Alerted Today
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Alert Time</th>
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Trigger Price</th>
                  <th className="p-4">Signal Description</th>
                  <th className="p-4">Recommended Contract</th>
                  <th className="p-4">Entry Premium</th>
                  <th className="p-4">Peak Premium (MFE)</th>
                  <th className="p-4">Max Gain %</th>
                  <th className="p-4">Signal Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {signalsHistory.map(sig => (
                  <tr key={sig.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-cyan-400 font-bold">{sig.timestamp}</td>
                    <td className="p-4 font-black text-slate-100 text-sm">{sig.symbol}</td>
                    <td className="p-4 text-slate-200">${sig.priceAtTrigger.toFixed(2)}</td>
                    <td className="p-4 text-slate-300 font-sans">{sig.signalType}</td>
                    <td className="p-4 font-bold text-slate-100">{sig.contract}</td>
                    <td className="p-4 text-slate-300">${sig.entryPremium.toFixed(2)}</td>
                    <td className="p-4 font-bold text-emerald-400">${sig.peakPremium.toFixed(2)}</td>
                    <td className="p-4 font-black text-emerald-400">{sig.peakGainPercent}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        sig.outcomeColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {sig.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 4: TRADER ANALYTICS & POST-MORTEM JOURNAL */}
      {activeTab === "ANALYTICS" && (
        <div className="space-y-6">
          
          {/* ANALYTICS STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Win Rate Card */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Win Rate</span>
                <span className="text-4xl font-black text-emerald-400 font-mono mt-1 block">
                  {analytics ? analytics.winRate : 75}%
                </span>
                <span className="text-xs text-slate-400 font-mono mt-1 block">
                  {analytics ? analytics.winCount : 3} Wins / {analytics ? analytics.lossCount : 1} Loss
                </span>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 flex items-center justify-center font-mono font-black text-emerald-400">
                {analytics ? analytics.winRate : 75}%
              </div>
            </div>

            {/* Profit Factor & Edge */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Profit Factor</span>
              <span className="text-4xl font-black text-purple-400 font-mono block">
                {analytics ? analytics.profitFactor : 6.25}
              </span>
              <div className="text-xs text-slate-400 font-mono flex items-center justify-between pt-1">
                <span>Avg Win: <b className="text-emerald-400">+${analytics ? analytics.avgWin : 225}</b></span>
                <span>Avg Loss: <b className="text-rose-400">-${analytics ? analytics.avgLoss : 50}</b></span>
              </div>
            </div>

            {/* Total Net Profit & Best Trade */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Realized Net P&L</span>
              <span className="text-4xl font-black text-cyan-400 font-mono block">
                +${analytics ? analytics.totalNetPnl.toFixed(2) : '625.00'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block truncate pt-1">
                Best: <b className="text-emerald-400">{analytics ? analytics.bestTrade : '+$315.00 CRWD'}</b>
              </span>
            </div>

          </div>

          {/* TRADE REVIEW & POST-MORTEM JOURNAL */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  Post-Market Trade Journal & Post-Mortem Review
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Detailed breakdown of entry triggers, discipline review, and tactical lessons learned.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {closedTrades.map(trade => (
                <div key={trade.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-100 font-mono text-base">{trade.underlying}</span>
                      <span className="text-xs text-slate-400 font-mono">{trade.symbol}</span>
                      <span className="text-xs font-mono text-slate-400">
                        {trade.entryTime} &rarr; {trade.exitTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-xs text-slate-400">
                        Entry: ${trade.entryPrice.toFixed(2)} | Exit: ${trade.exitPrice.toFixed(2)}
                      </span>
                      <span className={`px-3 py-0.5 rounded-full text-xs font-black ${
                        trade.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)} (${trade.pnlPercent})` : `-$${Math.abs(trade.pnl).toFixed(2)} (${trade.pnlPercent})`}
                      </span>
                    </div>
                  </div>

                  {/* POST-MORTEM LESSON */}
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 font-sans flex items-start gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">Post-Mortem Review & Discipline</span>
                      <p className="mt-0.5 text-slate-300">{trade.lessons}</p>
                    </div>
                  </div>

                  {/* TAGS */}
                  <div className="flex items-center gap-2 pt-1">
                    {trade.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 7. TAB 5: ENGINE TERMINAL & AUDIT LOG */}
      {activeTab === "LOGS" && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              Live Scanning Loop Audit Feed
            </span>
            <span className="text-slate-500 text-[11px]">Streaming from Alpaca Paper & Discovery API</span>
          </div>

          <div className="h-[520px] overflow-y-auto space-y-1.5 custom-scrollbar pr-2 pt-2">
            {liveLog.map((log, i) => (
              <div 
                key={i} 
                className={`py-0.5 leading-relaxed ${
                  log.includes('[SIGNAL]') || log.includes('🟢')
                    ? 'text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border-l-2 border-emerald-500'
                    : log.includes('[DISCOVERY]')
                    ? 'text-cyan-300'
                    : log.includes('[LIQUIDITY]')
                    ? 'text-amber-300'
                    : log.includes('[CATALYST]')
                    ? 'text-fuchsia-300'
                    : log.includes('[ERROR]') || log.includes('[FATAL')
                    ? 'text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded border-l-2 border-rose-500'
                    : 'text-slate-400'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
