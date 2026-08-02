"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Activity, Target, Zap, TrendingUp, AlertCircle, ArrowRight, ArrowUpRight, ArrowDownRight, Calendar, Bell, Radio } from "lucide-react";
import { io, Socket } from "socket.io-client";

export function ScannerDashboard() {
    const [isScanning, setIsScanning] = useState(false);
    const [activeEngine, setActiveEngine] = useState<'volume' | 'pop' | 'earnings' | 'profitable'>('volume');
    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [popData, setPopData] = useState<any[]>([]);
    const [earningsData, setEarningsData] = useState<any[]>([]);
    const [profitableData, setProfitableData] = useState<any[]>([]);
    const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
    const socketRef = useRef<Socket | null>(null);

    // Connect to live alert WebSocket stream
    useEffect(() => {
        const socket = io(window.location.origin);
        socketRef.current = socket;

        socket.on("profitable_trade_alert", (alert: any) => {
            setLiveAlerts(prev => [{ ...alert, receivedAt: Date.now() }, ...prev].slice(0, 30));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function runScanner() {
            setIsScanning(true);
            try {
                if (activeEngine === 'volume') {
                    const res = await fetch('/api/scanner/volume');
                    const results = await res.json();
                    if (isMounted) setVolumeData(results || []);
                } else if (activeEngine === 'pop') {
                    const res = await fetch('/api/scanner/pop');
                    const results = await res.json();
                    if (isMounted) setPopData(results || []);
                } else if (activeEngine === 'earnings') {
                    const res = await fetch('/api/scanner/earnings');
                    const results = await res.json();
                    if (isMounted) setEarningsData(results || []);
                } else if (activeEngine === 'profitable') {
                    const res = await fetch('/api/scanner/profitable');
                    const results = await res.json();
                    if (isMounted) setProfitableData(results || []);
                }
            } catch (error) {
                console.error("Scanner failed:", error);
            } finally {
                if (isMounted) setIsScanning(false);
            }
        }

        runScanner();
        // Poll every 30 seconds for live sweeps
        const interval = setInterval(runScanner, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeEngine]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Search className="h-8 w-8 text-blue-500" />
                        PULSE SCANNER
                    </h2>
                    <p className="text-slate-400 mt-1">Actively hunting for market inefficiencies and high-probability setups.</p>
                </div>
            </div>

            {/* Engine Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                    onClick={() => setActiveEngine('profitable')}
                    className={`p-6 rounded-2xl border transition-all text-left ${activeEngine === 'profitable' ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                    <Zap className={`h-8 w-8 mb-4 ${activeEngine === 'profitable' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <h3 className={`text-lg font-bold mb-1 ${activeEngine === 'profitable' ? 'text-cyan-400' : 'text-slate-300'}`}>Profit Hunter (+EV)</h3>
                    <p className="text-sm text-slate-500">Compares IV to dynamic Historical Volatility to spot highly mispriced options.</p>
                </button>

                <button
                    onClick={() => setActiveEngine('volume')}
                    className={`p-6 rounded-2xl border transition-all text-left ${activeEngine === 'volume' ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                    <Activity className={`h-8 w-8 mb-4 ${activeEngine === 'volume' ? 'text-blue-400' : 'text-slate-500'}`} />
                    <h3 className={`text-lg font-bold mb-1 ${activeEngine === 'volume' ? 'text-blue-400' : 'text-slate-300'}`}>Unusual Volume</h3>
                    <p className="text-sm text-slate-500">Detects massive whale sweeps and anomalous options activity &gt;300% of average.</p>
                </button>

                <button
                    onClick={() => setActiveEngine('pop')}
                    className={`p-6 rounded-2xl border transition-all text-left ${activeEngine === 'pop' ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                    <Target className={`h-8 w-8 mb-4 ${activeEngine === 'pop' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <h3 className={`text-lg font-bold mb-1 ${activeEngine === 'pop' ? 'text-purple-400' : 'text-slate-300'}`}>High P.O.P Screener</h3>
                    <p className="text-sm text-slate-500">Hunts for high IV crush setups and consolidation to sell premium.</p>
                </button>

                <button
                    onClick={() => setActiveEngine('earnings')}
                    className={`p-6 rounded-2xl border transition-all text-left ${activeEngine === 'earnings' ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                    <Zap className={`h-8 w-8 mb-4 ${activeEngine === 'earnings' ? 'text-orange-400' : 'text-slate-500'}`} />
                    <h3 className={`text-lg font-bold mb-1 ${activeEngine === 'earnings' ? 'text-orange-400' : 'text-slate-300'}`}>Earnings Engine</h3>
                    <p className="text-sm text-slate-500">Calculates upcoming straddle expected moves for explosive catalysts.</p>
                </button>
            </div>

            {/* Main Display Area */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 min-h-[400px] relative overflow-hidden">
                {isScanning && (
                    <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center flex-col">
                        <div className="relative flex items-center justify-center h-24 w-24 mb-4">
                            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <Search className="h-8 w-8 text-blue-400 animate-pulse" />
                        </div>
                        <p className="text-blue-400 font-bold tracking-widest uppercase animate-pulse">Running {activeEngine} heuristics...</p>
                    </div>
                )}

                {activeEngine === 'profitable' ? (
                    <div className="h-full relative z-10 p-6 overflow-y-auto max-h-[700px] hide-scrollbar animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Zap className="h-5 w-5 text-cyan-500" />
                                Mispriced +EV Opportunities
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                                Real-time Expected Value Scanner
                            </div>
                        </div>

                        {/* Live WebSocket Alert Feed */}
                        <div className="mb-6 bg-slate-950/70 border border-cyan-500/20 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
                                <div className="flex items-center gap-2">
                                    <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
                                    <span className="text-white font-black text-sm">Live Algo Stream</span>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold uppercase tracking-wider">
                                        {liveAlerts.length} alerts
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">New alerts auto-appear here in real time</span>
                            </div>

                            {liveAlerts.length === 0 ? (
                                <div className="px-4 py-6 text-center text-slate-600">
                                    <Radio className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm text-slate-500">Listening for live algo discoveries...</p>
                                    <p className="text-[10px] text-slate-600 mt-1">Scanner cycles every 60s — demo alert fires within 90s</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/50 max-h-[220px] overflow-y-auto">
                                    {liveAlerts.map((alert, idx) => {
                                        const isBuy = alert.action === "BUY";
                                        const secondsAgo = Math.floor((Date.now() - alert.receivedAt) / 1000);
                                        const timeStr = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo/60)}m ago`;
                                        return (
                                            <div key={`${alert.contractSymbol}-${alert.receivedAt}`} className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-900/40 transition-colors ${idx === 0 ? 'bg-cyan-950/10' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
                                                        isBuy ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                        {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-white font-black text-sm">{alert.symbol}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                                                isBuy ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            }`}>{alert.action}</span>
                                                            {alert.isSimulated && <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded uppercase font-bold">Demo</span>}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-mono">${alert.strike} {alert.type} • Exp {alert.expiration}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-base font-black italic ${isBuy ? 'text-cyan-400' : 'text-amber-400'}`}>+{alert.edgePercent}%</p>
                                                    <p className="text-[9px] text-slate-600">{timeStr}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {profitableData.length === 0 && !isScanning ? (
                            <div className="text-center py-20 text-slate-500">
                                <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No major +EV discrepancies detected at this second.</p>
                                <p className="text-sm mt-1">Scanner searches for absolute volatility deviations &gt; 8%.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {profitableData.map((item, idx) => {
                                    const isBuy = item.action === "BUY";
                                    return (
                                        <div key={idx} className={`p-5 bg-slate-900/50 border rounded-2xl hover:border-slate-700 transition-all group shadow-lg flex flex-col lg:flex-row justify-between lg:items-center gap-4 ${isBuy ? 'border-cyan-500/20 hover:border-cyan-500/40' : 'border-amber-500/20 hover:border-amber-500/40'}`}>
                                            <div className="flex items-start gap-4">
                                                <div className="bg-slate-800 h-16 w-16 rounded-xl flex flex-col items-center justify-center border border-slate-700 shrink-0">
                                                    <span className="text-lg font-black text-white">{item.symbol}</span>
                                                    <span className="text-[10px] text-slate-400">${item.marketPrice.toFixed(2)}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border ${isBuy ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                                                            {item.action}
                                                        </span>
                                                        <span className="text-slate-500 text-[10px] font-bold font-mono">
                                                            {item.contractSymbol}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-base font-bold text-white mb-0.5">
                                                        Strike ${item.strike} {item.type} • Exp {new Date(item.expiration).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 max-w-xl">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0 shrink-0">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                                                    <div className="text-slate-500">Mkt Price:</div>
                                                    <div className="text-white font-bold">${item.marketPrice}</div>
                                                    <div className="text-slate-500">BS Price:</div>
                                                    <div className="text-white font-bold">${item.theoreticalPrice}</div>
                                                    <div className="text-slate-500">IV vs HV:</div>
                                                    <div className="text-white font-bold">{item.iv}% vs {item.hv}%</div>
                                                </div>

                                                <div className="text-right flex flex-col items-end">
                                                    <span className={`text-2xl font-black italic tracking-tight ${isBuy ? "text-cyan-400" : "text-amber-400"}`}>
                                                        +{item.edgePercent}%
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block mb-1.5">Expected Edge</span>
                                                    <button 
                                                        onClick={() => {
                                                            // Copy contract symbol to clipboard
                                                            if (navigator.clipboard) {
                                                                navigator.clipboard.writeText(item.contractSymbol);
                                                                alert(`Option Contract code copied: ${item.contractSymbol}. Head to Trade Execution.`);
                                                            }
                                                        }}
                                                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${isBuy ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]'}`}
                                                    >
                                                        Copy Symbol
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : activeEngine === 'volume' ? (
                    <div className="h-full relative z-10 p-6 overflow-y-auto max-h-[500px] hide-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="h-5 w-5 text-blue-500" />
                                Smart Money Whale Sweeps
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                Live Scanning Core Basket (12 Tickers)
                            </div>
                        </div>

                        {volumeData.length === 0 && !isScanning ? (
                            <div className="text-center py-20 text-slate-500">
                                <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No major unusual volume anomalies detected right now.</p>
                                <p className="text-sm mt-1">System requires intraday relative volume &gt; 150%.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {volumeData.map((item, idx) => {
                                    const isBullish = item.changePercent > 0;
                                    const ratioStr = (parseFloat(item.volumeRatio) * 100).toFixed(0);

                                    return (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-900/50 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl transition-all group shadow-lg">
                                            <div className="flex items-center gap-6 mb-4 sm:mb-0">
                                                <div className="bg-slate-800 h-14 w-14 rounded-xl flex flex-col items-center justify-center border border-slate-700">
                                                    <span className="text-lg font-black text-white">{item.symbol}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${isBullish ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                                                            {item.impliedDirection}
                                                        </span>
                                                        <span className="text-slate-400 text-sm font-medium">Vol Surge: {ratioStr}%</span>
                                                    </div>
                                                    <div className="text-2xl font-black text-white flex items-center gap-2">
                                                        ${item.price.toFixed(2)}
                                                        <span className={`text-sm font-bold flex items-center ${isBullish ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {isBullish ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                            {Math.abs(item.changePercent).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Algorithm Suggestion</span>
                                                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2">
                                                    Analyze Flow <ArrowRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : activeEngine === 'pop' ? (
                    <div className="h-full relative z-10 p-6 overflow-y-auto max-h-[500px] hide-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Target className="h-5 w-5 text-purple-500" />
                                High P.O.P Premium Targets
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                </span>
                                Analyzing Volatility Crush
                            </div>
                        </div>

                        {popData.length === 0 && !isScanning ? (
                            <div className="text-center py-20 text-slate-500">
                                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No high-probability volatility crush setups found.</p>
                                <p className="text-sm mt-1">Check back when major tickers enter tight consolidation phases.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {popData.map((item, idx) => (
                                    <div key={idx} className="p-5 bg-slate-900/50 border border-slate-700/50 hover:border-purple-500/50 rounded-2xl transition-all group shadow-lg flex flex-col md:flex-row justify-between md:items-center gap-4">

                                        <div className="flex items-center gap-4">
                                            <div className="bg-slate-800 h-16 w-16 rounded-xl flex flex-col items-center justify-center border border-slate-700 shrink-0">
                                                <span className="text-lg font-black text-white">{item.symbol}</span>
                                                <span className="text-[10px] text-slate-400">${item.price.toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded text-[10px] font-bold tracking-wider uppercase">
                                                        {item.setup}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${item.urgency === 'High' ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                                                        Priority: {item.urgency}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold text-white mb-1">{item.strategy}</h4>
                                                <p className="text-sm text-slate-400 flex items-center gap-2">
                                                    <Target className="h-3 w-3 text-purple-400" />
                                                    <strong className="text-purple-400">{item.pop} P.O.P</strong> • {item.strikes}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 md:max-w-xs text-sm text-slate-300">
                                            <TrendingUp className="h-4 w-4 text-slate-500 mb-1 inline-block mr-2" />
                                            {item.reasoning}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full relative z-10 p-6 overflow-y-auto max-h-[500px] hide-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Zap className="h-5 w-5 text-orange-500" />
                                Earnings Catalyst Engine
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                                Next 14 Days Straddle Pricing
                            </div>
                        </div>

                        {earningsData.length === 0 && !isScanning ? (
                            <div className="text-center py-20 text-slate-500">
                                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No major earnings reports found in the upcoming 14-day window.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {earningsData.map((item, idx) => (
                                    <div key={idx} className="p-5 bg-slate-900/50 border border-slate-700/50 hover:border-orange-500/50 rounded-2xl transition-all group shadow-lg flex flex-col md:flex-row justify-between md:items-center gap-4">

                                        <div className="flex items-center gap-4">
                                            <div className="bg-slate-800 h-16 w-16 rounded-xl flex flex-col items-center justify-center border border-slate-700 shrink-0">
                                                <span className="text-lg font-black text-white">{item.symbol}</span>
                                                <span className="text-[10px] text-slate-400">${item.price.toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded text-[10px] font-bold tracking-wider uppercase">
                                                        {item.setup}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 font-bold border border-slate-700 rounded text-[10px] tracking-wider uppercase">
                                                        Date: {item.earningsDate}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold text-white mb-1">{item.strategy}</h4>
                                                <p className="text-sm text-slate-400 flex items-center gap-2">
                                                    <Zap className="h-3 w-3 text-orange-400" />
                                                    <strong className="text-orange-400">Exp Move: {item.expectedMove}</strong>
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">{item.strikes}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 md:max-w-xs text-sm text-slate-300">
                                            <TrendingUp className="h-4 w-4 text-slate-500 mb-1 inline-block mr-2" />
                                            {item.reasoning}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
