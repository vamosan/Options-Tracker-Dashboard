"use client";

import { useState, useEffect } from "react";
import { Play, Square, Settings, TrendingUp, AlertTriangle, ShieldCheck, Activity, DollarSign, Clock } from "lucide-react";

type TradeStatus = "OPEN" | "CLOSED";

interface BotTrade {
  id: string;
  symbol: string;
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

export function AlpacaBotDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Mock connecting to websocket/backend
    if (isRunning) {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] System Active. Scanning market...`]);
      setConnected(true);
    } else {
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] System Paused.`]);
      setConnected(false);
    }
  }, [isRunning]);

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 h-[85vh]">
      
      {/* LEFT PANE: Ledger & Post-Market Tracking */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-slate-200">Verified Historical Ledger</h2>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <div className="text-emerald-400">Win Rate: 0%</div>
            <div className="text-slate-300">Net P&L: $0.00</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {trades.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-3">
              <Clock className="w-8 h-8 opacity-50" />
              <p>No trades executed yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">{t.symbol}</td>
                    <td className="px-4 py-3 text-slate-400">${t.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-400">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : 'OPEN'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${t.pnl && t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl !== undefined ? `$${t.pnl.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Scanner & Live Intelligence */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-slate-200">Live Market Intelligence</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className="text-xs font-semibold text-slate-400 uppercase">{connected ? 'Connected' : 'Offline'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex gap-3">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
              isRunning 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/50 hover:bg-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <><Square className="w-4 h-4" /> Halt Autonomous Trading</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> Engage Autonomous Bot</>
            )}
          </button>
          <button className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Live Logs & Scans */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 custom-scrollbar space-y-2">
          {liveLog.map((log, i) => (
            <div key={i} className={`pb-2 border-b border-slate-800/50 ${log.includes('Scanning') ? 'text-cyan-400/80' : ''}`}>
              {log}
            </div>
          ))}
          <div className="animate-pulse text-slate-500">
            {isRunning ? '> Awaiting ORB breakout triggers (9:30-9:35 AM)...' : '> Standing by...'}
          </div>
        </div>
      </div>

    </div>
  );
}
