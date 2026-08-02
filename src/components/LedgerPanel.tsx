"use client";

import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface Signal {
    id: number;
    timestamp: string;
    symbol: string;
    action: string;
    rationale: string;
    entry_price: number;
    max_profit_pct: number;
    win_status: string;
    confidence_score: number;
}

export default function LedgerPanel() {
    const [signals, setSignals] = useState<Signal[]>([]);
    const [loading, setLoading] = useState(true);
    const [minConfidence, setMinConfidence] = useState<number>(0);
    const [timeFilter, setTimeFilter] = useState<string>("ALL");
    const [dateFilter, setDateFilter] = useState<string>("ALL");

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ledger');
            const data = await res.json();
            if (Array.isArray(data)) {
                setSignals(data);
            }
        } catch (e) {
            console.error("Failed to fetch ledger", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLedger();
    }, []);

    const markSignal = async (id: number, status: string, maxProfit: number) => {
        try {
            await fetch('/api/ledger', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, winStatus: status, maxProfitPct: maxProfit })
            });
            fetchLedger();
        } catch (e) {
            console.error("Failed to update signal", e);
        }
    };

    // Filter signals based on dropdowns
    const filteredSignals = signals.filter(s => {
        if (s.confidence_score < minConfidence) return false;
        
        if (timeFilter !== "ALL") {
            const date = new Date(s.timestamp);
            const hours = date.getHours();
            if (timeFilter === "MORNING" && (hours < 9 || hours >= 12)) return false;
            if (timeFilter === "AFTERNOON" && (hours < 12 || hours >= 16)) return false;
            if (timeFilter === "AFTER_HOURS" && (hours < 16)) return false;
        }

        if (dateFilter !== "ALL") {
            const date = new Date(s.timestamp);
            const today = new Date();
            const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            
            if (dateFilter === "TODAY" && !isToday) return false;
            if (dateFilter === "OLDER" && isToday) return false;
        }
        
        return true;
    });

    const wins = filteredSignals.filter(s => s.win_status === 'WIN').length;
    const losses = filteredSignals.filter(s => s.win_status === 'LOSS').length;
    const totalClosed = wins + losses;
    const winRate = totalClosed > 0 ? ((wins / totalClosed) * 100).toFixed(1) : "0.0";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-fuchsia-400" />
                    Trading Ledger & Backtest
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        <select 
                            value={minConfidence} 
                            onChange={(e) => setMinConfidence(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-fuchsia-500 transition-colors"
                        >
                            <option value={0}>All Confidence</option>
                            <option value={10}>&gt; 10 Score</option>
                            <option value={20}>&gt; 20 Score</option>
                            <option value={30}>&gt; 30 Score</option>
                            <option value={40}>&gt; 40 Score</option>
                            <option value={50}>&gt; 50 Score</option>
                            <option value={60}>&gt; 60 Score</option>
                            <option value={80}>&gt; 80 Score</option>
                            <option value={90}>&gt; 90 Score</option>
                        </select>

                        <select 
                            value={dateFilter} 
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-fuchsia-500 transition-colors"
                        >
                            <option value="ALL">All Dates</option>
                            <option value="TODAY">Today</option>
                            <option value="OLDER">Older</option>
                        </select>

                        <select 
                            value={timeFilter} 
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-fuchsia-500 transition-colors"
                        >
                            <option value="ALL">All Times</option>
                            <option value="MORNING">Morning (9am-12pm)</option>
                            <option value="AFTERNOON">Afternoon (12pm-4pm)</option>
                            <option value="AFTER_HOURS">After Hours</option>
                        </select>
                    </div>

                    <div className="bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800 flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Filtered Win Rate</span>
                        <span className="text-sm font-black text-emerald-400">{winRate}%</span>
                    </div>
                    <button onClick={fetchLedger} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white" title="Refresh Ledger">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-fuchsia-400' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto relative z-10">
                <table className="w-full text-left text-sm text-slate-400 border-collapse">
                    <thead className="text-xs uppercase bg-slate-950/50 border-b border-slate-800/50">
                        <tr>
                            <th className="px-4 py-3 font-bold">Time</th>
                            <th className="px-4 py-3 font-bold">Signal</th>
                            <th className="px-4 py-3 font-bold">Score</th>
                            <th className="px-4 py-3 font-bold">Entry</th>
                            <th className="px-4 py-3 font-bold">Rationale</th>
                            <th className="px-4 py-3 font-bold">Status</th>
                            <th className="px-4 py-3 font-bold">Resolve</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSignals.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-slate-500">
                                    No signals found for the current filters.
                                </td>
                            </tr>
                        ) : filteredSignals.map(signal => (
                            <tr key={signal.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                    {new Date(signal.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-bold text-white">
                                    {signal.symbol} 
                                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded ml-1 text-slate-300">{signal.action}</span>
                                </td>
                                <td className="px-4 py-3">
                                    {signal.confidence_score > 0 ? (
                                        <span className={`text-[10px] px-2 py-1 rounded font-black ${signal.confidence_score >= 80 ? 'text-emerald-400 bg-emerald-400/10' : signal.confidence_score >= 40 ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-400 bg-slate-800'}`}>
                                            {signal.confidence_score}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-600">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-300">
                                    ${signal.entry_price.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-xs max-w-xs truncate text-slate-400" title={signal.rationale}>
                                    {signal.rationale}
                                </td>
                                <td className="px-4 py-3">
                                    {signal.win_status === 'WIN' && <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs"><CheckCircle className="h-3 w-3"/> WIN ({signal.max_profit_pct}%)</span>}
                                    {signal.win_status === 'LOSS' && <span className="flex items-center gap-1 text-red-400 font-bold text-xs"><XCircle className="h-3 w-3"/> LOSS ({signal.max_profit_pct}%)</span>}
                                    {signal.win_status === 'PENDING' && <span className="flex items-center gap-1 text-amber-400 font-bold text-xs"><Clock className="h-3 w-3"/> PENDING</span>}
                                </td>
                                <td className="px-4 py-3">
                                    {signal.win_status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button onClick={() => markSignal(signal.id, 'WIN', 20.0)} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 text-[10px] font-bold">WIN</button>
                                            <button onClick={() => markSignal(signal.id, 'LOSS', -15.0)} className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 text-[10px] font-bold">LOSS</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
