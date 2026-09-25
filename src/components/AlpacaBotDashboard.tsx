"use client";

import { useState, useEffect } from "react";
import { Play, Square, Settings, ShieldCheck, Activity, DollarSign, Clock, TrendingUp, Zap, AlertCircle, RefreshCw, BarChart3, ChevronRight } from "lucide-react";

type TradeStatus = "OPEN" | "CLOSED";

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
  status: TradeStatus;
  rationale: string;
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
  status: string;
}

export function AlpacaBotDashboard() {
  const [isRunning, setIsRunning] = useState(true);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [setups, setSetups] = useState<DiscoveredSetup[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  const runScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/alpaca-bot/scan', { method: 'POST' });
      const data = await res.json();
      
      if (data.logs) {
        setLiveLog(prev => {
          const newLogs = [...prev, ...data.logs];
          return newLogs.slice(-60);
        });
      }
      if (data.setups && Array.isArray(data.setups)) {
        setSetups(data.setups);
      }
      if (data.trades && Array.isArray(data.trades)) {
        setTrades(data.trades);
      }
      setConnected(true);
      setLastScanTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Scan error:", err);
      setLiveLog(prev => [...prev, `[ERROR] Network error during scan: ${err.message}`]);
      setConnected(false);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] System Active. Scanning pre-market & live ORB setups...`]);
      setConnected(true);
      runScan();
      // Scan every 30 seconds
      interval = setInterval(runScan, 30000);
    } else {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] System Paused by user.`]);
      setConnected(false);
    }

    return () => clearInterval(interval);
  }, [isRunning]);

  // Metric calculations
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl && t.pnl > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalNetPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 min-h-[82vh]">
      
      {/* LEFT PANE: Verified Historical Ledger */}
      <div className="lg:w-5/12 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm tracking-wide">Verified Historical Ledger</h2>
              <p className="text-[11px] text-slate-400 font-mono">Automated Execution & P&L Log</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
              Win Rate: {winRate}%
            </div>
            <div className={`px-2.5 py-1 rounded-full font-mono ${totalNetPnl >= 0 ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'}`}>
              Net P&L: {totalNetPnl >= 0 ? `+$${totalNetPnl.toFixed(2)}` : `-$${Math.abs(totalNetPnl).toFixed(2)}`}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
          {trades.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 flex-col gap-2">
              <Clock className="w-8 h-8 opacity-40 animate-pulse" />
              <p className="text-xs">Awaiting breakout triggers to populate ledger...</p>
            </div>
          ) : (
            trades.map(t => (
              <div key={t.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono text-sm">{t.symbol}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {t.type}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'OPEN' 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Entry Fill</span>
                    <span className="text-slate-200 font-bold">${t.entryPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Stop-Loss</span>
                    <span className="text-rose-400 font-bold">${t.stopLoss.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Exit / Target</span>
                    <span className="text-slate-300 font-bold">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : 'TRAILING'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Net P&L</span>
                    <span className={`font-bold ${t.pnl && t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl !== undefined ? (t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`) : '--'}
                    </span>
                  </div>
                </div>

                {t.rationale && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/60 font-sans">
                    <Zap className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{t.rationale}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANE: Live Market Intelligence & Option Scanner */}
      <div className="lg:w-7/12 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
        
        {/* Header & Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm tracking-wide">Live Market Intelligence & Option Scanner</h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {lastScanTime ? `Last Sync: ${lastScanTime}` : 'Scanning...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                {connected ? 'Alpaca Live' : 'Connecting'}
              </span>
            </div>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isRunning 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
              }`}
            >
              {isRunning ? (
                <><Square className="w-3.5 h-3.5 fill-current" /> Halt Autonomous Trading</>
              ) : (
                <><Play className="w-3.5 h-3.5 fill-current" /> Engage Autonomous Bot</>
              )}
            </button>

            <button 
              onClick={runScan}
              disabled={isScanning}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
              title="Manual Trigger Scan"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Discovered Setups (Active Watchlist) */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Active Qualified Setups ($10B+ Cap • RVOL &gt; 2.0x • Tight Spreads)
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-semibold">
              {setups.length} Asset{setups.length !== 1 ? 's' : ''} Locked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {setups.map(s => (
              <div key={s.symbol} className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/40 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-100 text-base">{s.symbol}</span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">${s.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono font-bold">
                      Cap {s.marketCap}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 text-[10px] font-mono font-bold">
                      RVOL {s.rvol}
                    </span>
                  </div>
                </div>

                {/* Catalyst */}
                <div className="text-[11px] text-slate-300 italic line-clamp-1 border-l-2 border-cyan-500/50 pl-2">
                  "{s.catalyst}"
                </div>

                {/* Target Contract & Liquidity */}
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Target Option</span>
                    <span className="text-emerald-400 font-bold">{s.symbol} ${s.strike}C</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block uppercase">Ask / Bid</span>
                    <span className="text-slate-200 font-bold">${s.ask.toFixed(2)} / ${s.bid.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Spread</span>
                    <span className="text-cyan-400 font-bold">${s.spread.toFixed(2)}</span>
                  </div>
                </div>

                {/* 5-Min Opening Range Visualizer */}
                <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">ORB: ${s.orbLow} - ${s.orbHigh}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    s.status.includes('BREAKOUT') 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      : 'bg-slate-700/50 text-slate-300'
                  }`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Terminal Logs */}
        <div className="flex-1 p-4 bg-slate-950/70 overflow-y-auto font-mono text-xs text-slate-300 custom-scrollbar space-y-1.5 flex flex-col justify-end">
          {liveLog.length === 0 ? (
            <div className="text-slate-600 animate-pulse">&gt; Initializing background scanner...</div>
          ) : (
            liveLog.map((log, i) => (
              <div 
                key={i} 
                className={`leading-relaxed ${
                  log.includes('[EXECUTE]') 
                    ? 'text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded' 
                    : log.includes('[DISCOVERY]') 
                    ? 'text-cyan-300' 
                    : log.includes('[LIQUIDITY]') 
                    ? 'text-amber-300' 
                    : log.includes('[CATALYST]')
                    ? 'text-fuchsia-300'
                    : log.includes('[ERROR]') || log.includes('[FATAL')
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-400'
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div className="text-slate-600 text-[11px] pt-1 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-3 bg-cyan-400 animate-pulse"></span>
            <span>Autonomous Intelligence active • Polling Alpaca Paper API</span>
          </div>
        </div>

      </div>

    </div>
  );
}
