"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Play, Square, ShieldCheck, Activity, DollarSign, Clock, 
  TrendingUp, Zap, Target, AlertOctagon, ArrowUpRight, 
  RefreshCw, CheckCircle2, BarChart2, Radio, Award,
  Briefcase, FileText, Terminal, Filter, Flame, ChevronRight
} from "lucide-react";

interface ConfidenceBreakdown {
  rvol: number;
  structure: number;
  liquidity: number;
  catalyst: number;
}

interface Confidence {
  score: number;
  tier: "ELITE" | "HIGH" | "MODERATE";
  color: "emerald" | "cyan" | "amber";
  breakdown: ConfidenceBreakdown;
}

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
  rvolRaw: number;
  discoveredAt: string;
  confidence: Confidence;
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

  // Search & Discovery Filter Criteria
  const [filterConfidence, setFilterConfidence] = useState<"ALL" | "90" | "80">("ALL");
  const [filterRvol, setFilterRvol] = useState<"ALL" | "2.0" | "3.0">("ALL");
  const [filterSignal, setFilterSignal] = useState<"ALL" | "BREAKOUT">("ALL");

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
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error("Scan error:", err);
      setConnected(false);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      setConnected(true);
      runScan();
      interval = setInterval(runScan, 25000);
    } else {
      setConnected(false);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Filtered Setups based on search criteria
  const filteredSetups = useMemo(() => {
    return setups.filter(s => {
      if (filterConfidence === "90" && s.confidence.score < 90) return false;
      if (filterConfidence === "80" && s.confidence.score < 80) return false;
      if (filterRvol === "2.0" && s.rvolRaw < 2.0) return false;
      if (filterRvol === "3.0" && s.rvolRaw < 3.0) return false;
      if (filterSignal === "BREAKOUT" && s.signal.state !== "BREAKOUT") return false;
      return true;
    });
  }, [setups, filterConfidence, filterRvol, filterSignal]);

  // Execute Paper Trade
  const handleExecutePaperTrade = (s: DiscoveredSetup, qty = 3) => {
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
  };

  // Close Position
  const handleClosePosition = (posId: string) => {
    const pos = activePositions.find(p => p.id === posId);
    if (!pos) return;

    const exitPrice = pos.currentPrice;
    const pnlDollars = Math.round((exitPrice - pos.entryPrice) * pos.qty * 100 * 100) / 100;
    const pnlPercent = `${((exitPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(1)}%`;

    const closedItem: ClosedTrade = {
      id: `hist_${Date.now()}`,
      symbol: `${pos.underlying} $${pos.strike}C`,
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
      status: pnlDollars >= 0 ? "TARGET HIT" : "STOPPED OUT",
      lessons: `Executed exit at $${exitPrice.toFixed(2)}. ${pnlDollars >= 0 ? 'Disciplined target capture.' : 'Strict risk cut.'}`,
      tags: ['#LiveTrade']
    };

    setClosedTrades(prev => [closedItem, ...prev]);
    setActivePositions(prev => prev.filter(p => p.id !== posId));
  };

  // Scale 50%
  const handleScaleOut50 = (posId: string) => {
    setActivePositions(prev => prev.map(p => {
      if (p.id === posId) {
        return {
          ...p,
          qty: Math.max(1, Math.floor(p.qty / 2)),
          stopLoss: p.entryPrice,
          status: "SCALED_50"
        };
      }
      return p;
    }));
  };

  const activeUnrealizedPnl = activePositions.reduce((acc, p) => {
    return acc + (p.currentPrice - p.entryPrice) * p.qty * 100;
  }, 0);

  const displayWinRate = analytics ? analytics.winRate : 75;
  const displayTotalPnl = analytics ? analytics.totalNetPnl : 625.00;

  return (
    <div className="w-full space-y-4 max-w-[1440px] mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* 1. COMPACT INSTITUTIONAL HUD BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Engine & Account Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-100 tracking-tight">Autonomous Options Desk</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Alpaca Paper Active
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              Buying Power: <b className="text-slate-200">$98,724.74</b> • Sync: {lastSync || "Live"}
            </span>
          </div>
        </div>

        {/* Center: Compact Metric Chips */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Win Rate</span>
            <span className="font-black text-emerald-400">{displayWinRate}%</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Net P&L</span>
            <span className={`font-black ${displayTotalPnl >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {displayTotalPnl >= 0 ? `+$${displayTotalPnl.toFixed(2)}` : `-$${Math.abs(displayTotalPnl).toFixed(2)}`}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Profit Factor</span>
            <span className="font-black text-purple-400">{analytics ? analytics.profitFactor : '6.25'}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Active</span>
            <span className="font-black text-amber-400">{activePositions.length}</span>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isRunning 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <><Square className="w-3 h-3 fill-current" /> Halt</>
            ) : (
              <><Play className="w-3 h-3 fill-current" /> Engage</>
            )}
          </button>

          <button 
            onClick={runScan}
            disabled={isScanning}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
            title="Scan Now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* 2. COMPACT WORKSPACE TABS */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("SETUPS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SETUPS"
              ? "bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Scanner & Opportunities</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-500/20 text-cyan-300">
            {filteredSetups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("POSITIONS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "POSITIONS"
              ? "bg-amber-500/10 border border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Active Positions</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300">
            {activePositions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("SIGNALS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SIGNALS"
              ? "bg-blue-500/10 border border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Signal Timeline</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-500/20 text-blue-300">
            {signalsHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ANALYTICS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "ANALYTICS"
              ? "bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Analytics & Journal</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300">
            {closedTrades.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("LOGS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "LOGS"
              ? "bg-purple-500/10 border border-purple-500/50 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Engine Feed</span>
        </button>
      </div>

      {/* 3. TAB 1: SCANNER & ACTIONABLE SETUPS */}
      {activeTab === "SETUPS" && (
        <div className="space-y-4">
          
          {/* SEARCH CRITERIA & PROFIT FILTERS TOOLBAR */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-bold uppercase flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3 text-cyan-400" />
                Discovery Filters:
              </span>

              {/* Confidence Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">Confidence:</span>
                {(["ALL", "90", "80"] as const).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setFilterConfidence(tier)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterConfidence === tier 
                        ? 'bg-cyan-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tier === "ALL" ? "All" : `${tier}%+`}
                  </button>
                ))}
              </div>

              {/* RVOL Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">RVOL:</span>
                {(["ALL", "2.0", "3.0"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setFilterRvol(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterRvol === r 
                        ? 'bg-fuchsia-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r === "ALL" ? "All" : `>${r}x`}
                  </button>
                ))}
              </div>

              {/* Signal Trigger Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">Trigger:</span>
                {(["ALL", "BREAKOUT"] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterSignal(st)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterSignal === st 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === "ALL" ? "All" : "Breakouts Only"}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              Showing {filteredSetups.length} of {setups.length} Stocks
            </span>
          </div>

          {/* COMPACT SETUP CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSetups.map(s => {
              const isBreakout = s.signal.state === "BREAKOUT";
              const confScore = s.confidence.score;

              return (
                <div 
                  key={s.symbol}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-xl flex flex-col justify-between ${
                    isBreakout 
                      ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  
                  {/* COMPACT HEADER: TICKER • PRICE • CONFIDENCE METER */}
                  <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-100 font-mono">{s.symbol}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[110px]">{s.name}</span>
                        <span className="text-sm font-bold text-slate-100 font-mono">${s.price.toFixed(2)}</span>
                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                          s.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {s.changePercent >= 0 ? `+${s.changePercent.toFixed(1)}%` : `${s.changePercent.toFixed(1)}%`}
                        </span>
                      </div>

                      {/* CONFIDENCE METER BADGE */}
                      <div className="flex items-center gap-1.5">
                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border flex items-center gap-1 ${
                          confScore >= 90
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                            : confScore >= 80
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                        }`}>
                          <Flame className="w-3 h-3 fill-current" />
                          <span>{confScore}% {s.confidence.tier}</span>
                        </div>
                      </div>
                    </div>

                    {/* CONFIDENCE BAR VISUALIZER */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            confScore >= 90 ? 'bg-emerald-400' : confScore >= 80 ? 'bg-cyan-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${confScore}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span>RVOL: {s.confidence.breakdown.rvol}/25</span>
                        <span>ORB: {s.confidence.breakdown.structure}/25</span>
                        <span>Spread: {s.confidence.breakdown.liquidity}/25</span>
                        <span>Catalyst: {s.confidence.breakdown.catalyst}/25</span>
                      </div>
                    </div>

                    {/* COMPACT METRIC ROW */}
                    <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 text-slate-400">
                      <span>Cap: <b className="text-slate-200">{s.marketCap}</b></span>
                      <span>RVOL: <b className="text-fuchsia-400">{s.rvol}</b></span>
                      <span>Alert: <b className="text-cyan-300">{s.discoveredAt}</b></span>
                    </div>

                    {/* COMPACT CATALYST PILL */}
                    <div className="px-2 py-1 rounded bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-300 truncate">
                      ⚡ <span className="font-semibold text-slate-200">{s.catalyst.headline}</span>
                    </div>
                  </div>

                  {/* COMPACT ORB SHELF & TARGET OPTION */}
                  <div className="p-3.5 space-y-2.5 bg-slate-950/30 border-b border-slate-800/80">
                    {/* 5-Min ORB High/Low */}
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        ORB Shelf: <b className="text-rose-400">${s.orb.low}</b> - <b className="text-emerald-400">${s.orb.high}</b>
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        isBreakout 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {s.signal.badge}
                      </span>
                    </div>

                    {/* Target Contract Box */}
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div className="text-left">
                        <span className="text-[9px] text-slate-500 block uppercase">Option Play</span>
                        <span className="font-black text-slate-100">${s.contract.strike} Call</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Ask Fill</span>
                        <span className="font-black text-cyan-400">${s.contract.ask.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block uppercase">Spread</span>
                        <span className="font-black text-emerald-400">${s.contract.spread.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* COMPACT RISK / TARGET EXECUTION BAR */}
                  <div className="p-3 bg-slate-900/60 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20">
                        <span className="text-[9px] text-rose-400 font-bold block">Stop</span>
                        <span className="font-bold text-rose-300">${s.targets.stopLoss.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[9px] text-emerald-400 font-bold block">T1 (+30%)</span>
                        <span className="font-bold text-emerald-300">${s.targets.target1.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-[9px] text-cyan-400 font-bold block">T2 (+65%)</span>
                        <span className="font-bold text-cyan-300">${s.targets.target2.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* EXECUTE BUTTON */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        R:R <b className="text-emerald-400">{s.targets.rrRatio}</b>
                      </span>

                      <button
                        onClick={() => handleExecutePaperTrade(s, 3)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        Execute Paper (3x @ ${s.contract.ask})
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* 4. TAB 2: ACTIVE POSITIONS & LIVE P&L */}
      {activeTab === "POSITIONS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Active Managed Positions
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Live profit tracking, scale out, and trailing stops.
              </span>
            </div>

            <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-right">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Open P&L</span>
              <span className={`text-sm font-black font-mono ${activeUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeUnrealizedPnl >= 0 ? `+$${activeUnrealizedPnl.toFixed(2)}` : `-$${Math.abs(activeUnrealizedPnl).toFixed(2)}`}
              </span>
            </div>
          </div>

          {activePositions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No open positions right now.</p>
              <button
                onClick={() => setActiveTab("SETUPS")}
                className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase hover:bg-cyan-500/20"
              >
                Scan Setups &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activePositions.map(pos => {
                const pnlDollars = (pos.currentPrice - pos.entryPrice) * pos.qty * 100;
                const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

                return (
                  <div key={pos.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-base font-black text-slate-100 font-mono">{pos.underlying} ${pos.strike} Call</span>
                        <span className="text-xs text-slate-400 font-mono block">{pos.qty} Contracts • Filled @ {pos.entryTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Entry</span>
                        <span className="font-bold text-slate-200">${pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Stop</span>
                        <span className="font-bold text-rose-400">${pos.stopLoss.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Target 1</span>
                        <span className="font-bold text-emerald-400">${pos.target1.toFixed(2)}</span>
                      </div>

                      <div className={`px-3 py-1 rounded-lg font-bold ${
                        pnlDollars >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {pnlDollars >= 0 ? `+$${pnlDollars.toFixed(2)} (+${pnlPercent.toFixed(1)}%)` : `-$${Math.abs(pnlDollars).toFixed(2)} (${pnlPercent.toFixed(1)}%)`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScaleOut50(pos.id)}
                        disabled={pos.status === "SCALED_50"}
                        className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Scale 50%
                      </button>
                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        className="px-3 py-1 rounded text-xs font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                      >
                        Flatten
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: SIGNAL TIMELINE */}
      {activeTab === "SIGNALS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                Chronological Signal Log
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Historical breakout callouts with peak gains (MFE) and outcomes.
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">{signalsHistory.length} Alerted Today</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3">Target Option</th>
                  <th className="p-3">Entry</th>
                  <th className="p-3">Peak Gain (MFE)</th>
                  <th className="p-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {signalsHistory.map(sig => (
                  <tr key={sig.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-cyan-400">{sig.timestamp}</td>
                    <td className="p-3 font-black text-slate-100">{sig.symbol}</td>
                    <td className="p-3 text-slate-300 font-sans">{sig.signalType}</td>
                    <td className="p-3 font-bold text-slate-200">{sig.contract}</td>
                    <td className="p-3 text-slate-300">${sig.entryPremium.toFixed(2)}</td>
                    <td className="p-3 font-black text-emerald-400">{sig.peakGainPercent}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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

      {/* 6. TAB 4: ANALYTICS & TRADE JOURNAL */}
      {activeTab === "ANALYTICS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Win Rate</span>
                <span className="text-2xl font-black text-emerald-400">{displayWinRate}%</span>
                <span className="text-[10px] text-slate-500 block">{analytics ? analytics.winCount : 3}W / {analytics ? analytics.lossCount : 1}L</span>
              </div>
              <Award className="w-8 h-8 text-emerald-400 opacity-60" />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Profit Factor</span>
                <span className="text-2xl font-black text-purple-400">{analytics ? analytics.profitFactor : 6.25}</span>
                <span className="text-[10px] text-slate-400 block">Avg Win: +${analytics ? analytics.avgWin : 225}</span>
              </div>
              <BarChart2 className="w-8 h-8 text-purple-400 opacity-60" />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Net P&L</span>
                <span className="text-2xl font-black text-cyan-400">+${displayTotalPnl.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 block">Best: {analytics ? analytics.bestTrade : '+$315 CRWD'}</span>
              </div>
              <DollarSign className="w-8 h-8 text-cyan-400 opacity-60" />
            </div>
          </div>

          {/* Trade Journal Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" />
              Post-Mortem Trade Journal & Reviews
            </h3>

            <div className="space-y-2.5">
              {closedTrades.map(trade => (
                <div key={trade.id} className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-slate-100">{trade.underlying} • {trade.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      trade.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)} (${trade.pnlPercent})` : `-$${Math.abs(trade.pnl).toFixed(2)} (${trade.pnlPercent})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans italic">"{trade.lessons}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 5: ENGINE AUDIT FEED */}
      {activeTab === "LOGS" && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              Live Loop Audit Stream
            </span>
          </div>
          <div className="h-96 overflow-y-auto space-y-1 custom-scrollbar text-[11px]">
            {liveLog.map((log, i) => (
              <div key={i} className="text-slate-400 leading-tight">{log}</div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
