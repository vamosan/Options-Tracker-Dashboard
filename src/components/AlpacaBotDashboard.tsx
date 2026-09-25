"use client";

import { useState, useEffect } from "react";
import { 
  Play, Square, ShieldCheck, Activity, DollarSign, Clock, 
  TrendingUp, Zap, Target, AlertOctagon, ArrowUpRight, 
  RefreshCw, ChevronRight, CheckCircle2, BarChart2, Radio,
  ArrowRight, ShieldAlert, Sparkles, Terminal
} from "lucide-react";

interface RiskMetrics {
  entryPrice: number;
  target1: number;
  target2: number;
  stopLoss: number;
  underlyingStop: number;
  underlyingTarget: number;
  riskPerContract: number;
  rewardTarget1: number;
  rewardTarget2: number;
  rrRatio: string;
}

interface DiscoveredSetup {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: string;
  rvol: string;
  catalyst: string;
  contract: string;
  strike: number;
  ask: number;
  bid: number;
  spread: number;
  orbHigh: number;
  orbLow: number;
  signalState: "BREAKOUT" | "PENDING" | "BREAKDOWN";
  signalBadge: string;
  signalAction: string;
  riskMetrics: RiskMetrics;
}

interface BotTrade {
  id: string;
  symbol: string;
  underlying?: string;
  type: "CALL" | "PUT";
  entryTime: string;
  entryPrice: number;
  qty: number;
  stopLoss: number;
  exitTime?: string;
  exitPrice?: number;
  pnl?: number;
  status: string;
  rationale: string;
}

export function AlpacaBotDashboard() {
  const [isRunning, setIsRunning] = useState(true);
  const [activeView, setActiveView] = useState<"SIGNALS" | "LEDGER" | "TERMINAL">("SIGNALS");
  const [setups, setSetups] = useState<DiscoveredSetup[]>([]);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const runScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/alpaca-bot/scan", { method: "POST" });
      const data = await res.json();

      if (data.logs) {
        setLiveLog(prev => [...prev, ...data.logs].slice(-75));
      }
      if (data.setups && Array.isArray(data.setups)) {
        setSetups(data.setups);
      }
      if (data.trades && Array.isArray(data.trades)) {
        setTrades(data.trades);
      }
      setConnected(true);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Scan error:", err);
      setLiveLog(prev => [...prev, `[ERROR] Scan failure: ${err.message}`]);
      setConnected(false);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Autonomous Engine online. Scanning live setups...`]);
      setConnected(true);
      runScan();
      interval = setInterval(runScan, 25000);
    } else {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Autonomous Engine paused.`]);
      setConnected(false);
    }

    return () => clearInterval(interval);
  }, [isRunning]);

  // Derived Performance Metrics
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl && t.pnl > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <div className="w-full space-y-6 pb-20 max-w-[1440px] mx-auto animate-in fade-in duration-300">
      
      {/* 1. TOP INSTITUTIONAL HUD BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-100 tracking-tight">Autonomous Options Intelligence Hub</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Alpaca Paper Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {lastSync ? `Live Sync Active • Last scanned at ${lastSync}` : "Connecting to market streams..."}
            </p>
          </div>
        </div>

        {/* Center: Live Performance Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Verified Win Rate</span>
            <span className="text-base font-black text-emerald-400 font-mono">{winRate}%</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Ledger Net P&L</span>
            <span className={`text-base font-black font-mono ${totalPnl >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
            </span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Active Setups</span>
            <span className="text-base font-black text-slate-100 font-mono">{setups.length} Qualified</span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2.5">
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
            title="Force Instant Rescan"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* 2. NAVIGATION VIEW SWITCHER */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveView("SIGNALS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeView === "SIGNALS"
              ? "bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Signals & Risk/Reward</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 ml-1">
            {setups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView("LEDGER")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeView === "LEDGER"
              ? "bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verified Historical Ledger</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 ml-1">
            {trades.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView("TERMINAL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeView === "TERMINAL"
              ? "bg-purple-500/10 border border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Live Engine Feed</span>
        </button>
      </div>

      {/* 3. VIEW 1: ACTIONABLE INTELLIGENCE (STOCK • SIGNAL • OPTION • RISK/TARGET) */}
      {activeView === "SIGNALS" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                <span>Actionable Options Setups</span>
              </h2>
              <p className="text-xs text-slate-400">
                Institutional Discovery: Filtered for Market Cap &gt; $10B, RVOL &gt; 2.0x, Penny-to-Nickel Spreads, and 5-min ORB mapping.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Auto-updating every 25s
            </span>
          </div>

          {setups.length === 0 ? (
            <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto animate-spin" />
              <h3 className="text-sm font-bold text-slate-200">Scanning pre-market & live session data...</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Pinging Alpaca Paper API and screening $10B+ cap equities. Cards will automatically populate as soon as criteria align.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {setups.map(s => {
                const isBreakout = s.signalState === "BREAKOUT";
                return (
                  <div 
                    key={s.symbol}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xl ${
                      isBreakout 
                        ? 'bg-slate-900/90 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.12)]' 
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    
                    {/* SECTION 1: ASSET HEADER & CATALYST */}
                    <div className="p-5 border-b border-slate-800/80 bg-slate-900/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-slate-100 tracking-tight">{s.symbol}</span>
                            <span className="text-xs font-medium text-slate-400 truncate max-w-[180px]">{s.name}</span>
                            <span className="text-base font-black font-mono text-slate-100">
                              ${s.price.toFixed(2)}
                            </span>
                            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                              s.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {s.changePercent >= 0 ? `+${s.changePercent.toFixed(2)}%` : `${s.changePercent.toFixed(2)}%`}
                            </span>
                          </div>
                        </div>

                        {/* Institutional Filter Badges */}
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono">
                            Cap {s.marketCap}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 font-mono">
                            RVOL {s.rvol}
                          </span>
                        </div>
                      </div>

                      {/* Hard Fundamental Catalyst */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs">
                        <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block">Catalyst Trigger</span>
                          <p className="text-slate-300 italic font-medium mt-0.5 line-clamp-2">
                            "{s.catalyst}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: SIGNAL BANNER & 5-MIN ORB SHELF */}
                    <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signal Trigger:</span>
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                            isBreakout 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            {s.signalBadge}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-300 font-mono">
                          Action: <span className={isBreakout ? 'text-emerald-400 font-black' : 'text-slate-400'}>{s.signalAction}</span>
                        </span>
                      </div>

                      {/* Opening Range (9:30-9:35 AM ET) Shelf Bounds */}
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">ORB Low (Shelf)</span>
                          <span className="text-rose-400 font-bold text-sm">${s.orbLow.toFixed(2)}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Spot Price</span>
                          <span className="text-slate-200 font-bold text-sm">${s.price.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">ORB High (Breakout)</span>
                          <span className="text-emerald-400 font-bold text-sm">${s.orbHigh.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: THE TARGET OPTION CONTRACT */}
                    <div className="p-4 border-b border-slate-800/80 bg-slate-900/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                          Target Option Contract (Penny-to-Nickel Spread)
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                          {s.contract}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Target Strike</span>
                          <span className="text-base font-black text-slate-100">{s.symbol} ${s.strike} Call</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Ask (Entry Fill)</span>
                          <span className="text-base font-black text-cyan-400">${s.ask.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Spread (Liquidity)</span>
                          <span className="text-base font-black text-emerald-400">${s.spread.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: THE RISK / REWARD MATRIX (NO GUESSWORK) */}
                    <div className="p-5 bg-slate-900/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          Risk vs. Target Execution Plan
                        </span>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                          R:R Ratio: <span className="text-emerald-400 font-bold">{s.riskMetrics.rrRatio}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                        {/* STOP LOSS */}
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                          <span className="text-[10px] text-rose-400 font-bold uppercase block">Stop-Loss Shelf</span>
                          <span className="text-base font-black text-rose-300 block mt-0.5">
                            ${s.riskMetrics.stopLoss.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-rose-400/80 block mt-1">
                            Max Risk: -${s.riskMetrics.riskPerContract}/ct
                          </span>
                        </div>

                        {/* TARGET 1 */}
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <span className="text-[10px] text-emerald-400 font-bold uppercase block">Target 1 (+30%)</span>
                          <span className="text-base font-black text-emerald-300 block mt-0.5">
                            ${s.riskMetrics.target1.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-emerald-400/80 block mt-1">
                            Gain: +${s.riskMetrics.rewardTarget1}/ct
                          </span>
                        </div>

                        {/* TARGET 2 */}
                        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                          <span className="text-[10px] text-cyan-400 font-bold uppercase block">Target 2 (+60%)</span>
                          <span className="text-base font-black text-cyan-300 block mt-0.5">
                            ${s.riskMetrics.target2.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-cyan-400/80 block mt-1">
                            Gain: +${s.riskMetrics.rewardTarget2}/ct
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono text-[11px]">
                          Underlying Stop: <b className="text-slate-200">${s.riskMetrics.underlyingStop}</b> • Target: <b className="text-slate-200">${s.riskMetrics.underlyingTarget}</b>
                        </span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Alpaca Autonomous Ready
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VIEW 2: VERIFIED HISTORICAL LEDGER */}
      {activeView === "LEDGER" && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Verified Execution & Performance Ledger
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Full audit trail of entry fills, stop-loss shelves, peak exits, and realized P&L.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Win Rate: {winRate}%
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                Total Realized: +${totalPnl.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Contract / Stock</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Entry Fill</th>
                  <th className="p-4">Stop-Loss</th>
                  <th className="p-4">Exit Price</th>
                  <th className="p-4 text-right">Net P&L</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trades.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-400">{t.entryTime}</td>
                    <td className="p-4 font-bold text-slate-100">{t.symbol}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {t.type}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-200">${t.entryPrice.toFixed(2)}</td>
                    <td className="p-4 font-bold text-rose-400">${t.stopLoss.toFixed(2)}</td>
                    <td className="p-4 font-bold text-slate-300">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : 'OPEN'}</td>
                    <td className={`p-4 text-right font-black ${t.pnl && t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl !== undefined ? (t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`) : '--'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.status.includes('TARGET') || t.status === 'CLOSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 max-w-[280px] truncate font-sans text-xs">
                      {t.rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VIEW 3: LIVE SYSTEM FEED & AUDIT TRAIL */}
      {activeView === "TERMINAL" && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              Live Scanning Loop Audit Feed
            </span>
            <span className="text-slate-500 text-[11px]">Streaming from Alpaca Paper & Discovery API</span>
          </div>

          <div className="h-[500px] overflow-y-auto space-y-1.5 custom-scrollbar pr-2 pt-2">
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
