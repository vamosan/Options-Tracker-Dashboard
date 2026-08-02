"use client";

import React, { useState, useEffect, useRef } from "react";
import { Zap, ArrowUpRight, ArrowDownRight, Newspaper, Activity, AlertCircle, BarChart2, TrendingUp, Target, Crosshair, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { MomentumNewsTicker } from "./MomentumNewsTicker";
import { AgenticDeskPanel } from "./AgenticDeskPanel";
import { InstitutionalFlowRadar } from "./InstitutionalFlowRadar";
import LedgerPanel from "./LedgerPanel";

interface MomentumAlert {
    symbol: string;
    underlyingPrice: number;
    contractSymbol: string;
    type: "Call" | "Put";
    strike: number;
    expiration: string;
    marketPrice: number;
    targetPrice?: number;
    stopPrice?: number;
    volume: number;
    openInterest: number;
    volumeRatio: number;
    sentimentScore: number;
    sentimentLabel: string;
    alignment: string;
    headlines: string[];
    timestamp: string;
    isSimulated?: boolean;
    receivedAt?: number;
    confidenceScore?: number;
    isZeroDte?: boolean;
    tradeSuggestion?: string;
}

interface MomentumDashboardProps {
    onAddTrade?: (trade: any) => void;
}

export function MomentumDashboard({ onAddTrade }: MomentumDashboardProps) {
    const [alerts, setAlerts] = useState<MomentumAlert[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const [standardTimer, setStandardTimer] = useState(60);
    const [zeroDteTimer, setZeroDteTimer] = useState(30);

    useEffect(() => {
        const interval = setInterval(() => {
            setStandardTimer(prev => prev > 1 ? prev - 1 : 60);
            setZeroDteTimer(prev => prev > 1 ? prev - 1 : 30);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const socket = io(window.location.origin);
        socketRef.current = socket;

        socket.on("momentum_trade_alert", (alert: MomentumAlert) => {
            setAlerts(prev => {
                const newAlerts = [{ ...alert, receivedAt: Date.now() }, ...prev];
                // Deduplicate by TICKER and 0DTE status, so we only show the best current contract per symbol
                const uniqueAlerts = Array.from(new Map(newAlerts.map(item => [`${item.symbol}-${item.isZeroDte}`, item])).values());
                uniqueAlerts.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));
                return uniqueAlerts.slice(0, 15);
            });
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handlePaperTrade = (alert: MomentumAlert) => {
        if (!onAddTrade) return;
        const newTrade = {
            id: `PAPER-${Date.now()}`,
            symbol: alert.symbol,
            type: alert.type,
            strike: alert.strike,
            expiration: alert.expiration,
            premium: alert.marketPrice,
            quantity: 1,
            notes: `🤖 Bot Suggested (${alert.confidenceScore || 0}% Conf, ${alert.alignment})`,
        };
        onAddTrade(newTrade);
    };

    const standardAlerts = alerts.filter(a => a.symbol !== "SPY" || !a.isZeroDte);
    const zeroDteAlerts = alerts.filter(a => a.symbol === "SPY" && a.isZeroDte);

    const renderAlertCard = (alert: MomentumAlert, idx: number) => {
        const isBullish = alert.alignment.includes("BULLISH");
        const isBearish = alert.alignment.includes("BEARISH");
        const isDivergence = alert.alignment.includes("Divergence");

        const glowColor = isBullish ? "rgba(16, 185, 129, 0.15)" : isBearish ? "rgba(239, 68, 68, 0.15)" : "rgba(217, 70, 239, 0.15)";
        const borderColor = isBullish ? "border-emerald-500/30" : isBearish ? "border-red-500/30" : "border-fuchsia-500/30";
        const badgeColor = isBullish ? "bg-emerald-500/20 text-emerald-400" : isBearish ? "bg-red-500/20 text-red-400" : "bg-fuchsia-500/20 text-fuchsia-400";

        return (
            <motion.div 
                key={`${alert.contractSymbol}-${alert.timestamp}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
                className={`bg-slate-900 border ${borderColor} rounded-2xl overflow-hidden shadow-2xl relative flex flex-col`}
                style={{ boxShadow: `0 0 40px ${glowColor}, inset 0 0 20px ${glowColor}` }}
            >
                {/* Header Section */}
                <div className="p-4 md:p-6 border-b border-slate-800/50 flex flex-col md:flex-row justify-between gap-4 md:items-start relative z-10">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center ${
                            alert.type === 'Call' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {alert.type === 'Call' ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="text-2xl font-black text-white tracking-tight">{alert.symbol}</h3>
                                {alert.isZeroDte && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)] animate-pulse uppercase tracking-wider">
                                        0DTE Scalp
                                    </span>
                                )}
                                {isDivergence && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/50 uppercase tracking-wider">
                                        Divergence
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                <span>${alert.strike} {alert.type.toUpperCase()}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400">Exp: {alert.expiration}</span>
                            </div>
                        </div>
                    </div>

                    {/* VADER & Confidence Stats */}
                    <div className="flex flex-col items-start md:items-end gap-2 min-w-[140px]">
                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                            {alert.alignment}
                        </div>
                        {alert.confidenceScore && (
                            <div className="w-full">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                    <span>CONFIDENCE</span>
                                    <span className="text-white">{alert.confidenceScore}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            alert.confidenceScore > 80 ? 'bg-emerald-500' : 
                                            alert.confidenceScore > 60 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`} 
                                        style={{ width: `${alert.confidenceScore}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body Section */}
                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    
                    {/* Left: Option Flow Data */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Volume</span>
                                <span className="text-sm font-black text-white">{alert.volume?.toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Open Int</span>
                                <span className="text-sm font-black text-white">{alert.openInterest?.toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Vol / OI</span>
                                <span className="text-sm font-black text-fuchsia-400">{alert.volumeRatio?.toFixed(2)}x</span>
                            </div>
                        </div>

                        {/* Execution Plan */}
                        {alert.targetPrice && alert.stopPrice && (
                            <div className="bg-slate-950/80 border border-slate-700/50 rounded-xl p-3 shadow-inner">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center justify-between">
                                    <span>Execution Plan</span>
                                    <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">1 Contract</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono font-bold">
                                    <div className="flex flex-col items-center text-red-400">
                                        <span className="flex items-center gap-1 mb-0.5"><ShieldAlert className="h-3 w-3"/> Stop</span>
                                        <span className="text-sm">${alert.stopPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-slate-300">
                                        <span className="flex items-center gap-1 mb-0.5"><Crosshair className="h-3 w-3"/> Entry</span>
                                        <span className="text-sm">${alert.marketPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-emerald-400">
                                        <span className="flex items-center gap-1 mb-0.5"><Target className="h-3 w-3"/> Target</span>
                                        <span className="text-sm">${alert.targetPrice.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: News & Sentiment */}
                    <div className="flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">VADER Sentiment</span>
                                <span className={`text-xs font-black ${
                                    alert.sentimentScore >= 0.15 ? 'text-emerald-400' :
                                    alert.sentimentScore <= -0.15 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                    {alert.sentimentScore > 0 ? '+' : ''}{alert.sentimentScore.toFixed(2)}
                                </span>
                            </div>
                            {alert.headlines && alert.headlines.length > 0 ? (
                                <ul className="space-y-1.5">
                                    {alert.headlines.slice(0, 2).map((headline, i) => (
                                        <li key={i} className="text-[11px] text-slate-300 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800/50 leading-snug line-clamp-2">
                                            {headline}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-[11px] text-slate-500 italic">No recent news catalysts found.</div>
                            )}
                        </div>

                        {onAddTrade && (
                            <button 
                                onClick={() => handlePaperTrade(alert)}
                                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5"
                            >
                                <Activity className="h-4 w-4" />
                                1-Click Paper Trade
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Activity className="h-8 w-8 text-fuchsia-500" />
                        MOMENTUM & SENTIMENT BOT
                    </h2>
                    <p className="text-slate-400 mt-1">Cross-referencing Unusual Options Volume with Real-Time News Sentiment for high-probability scalps.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-2 rounded-xl">
                    <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
                    </span>
                    Live VADER Analysis Engine
                </div>
            </div>

            <MomentumNewsTicker />
            
            <AgenticDeskPanel />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Standard Alerts Feed */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-fuchsia-500" />
                            Standard Swings
                        </span>
                        <span className="text-xs font-mono text-slate-500 font-medium">Refreshes in {standardTimer}s</span>
                    </h3>
                    {standardAlerts.length === 0 ? (
                        <div className="bg-slate-900/50 rounded-3xl border border-slate-800/50 p-10 text-center h-[300px] flex flex-col items-center justify-center">
                            <Activity className="h-12 w-12 text-slate-600 mb-4 animate-pulse opacity-50" />
                            <h3 className="text-lg font-bold text-white mb-2">Scanning Watchlist...</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                The bot is actively scanning for Volume/OI ratios &gt; 1.2x.
                            </p>
                        </div>
                    ) : (
                        standardAlerts
                            .filter(alert => alert.confidenceScore >= 30)
                            .sort((a, b) => b.confidenceScore - a.confidenceScore)
                            .slice(0, 3)
                            .map((alert, idx) => renderAlertCard(alert, idx))
                    )}
                    {standardAlerts.length > 0 && standardAlerts.filter(a => a.confidenceScore >= 30).length === 0 && (
                        <div className="text-center text-xs text-slate-500 py-4 bg-slate-900/30 rounded-xl border border-slate-800/30">
                            Signals generated, but none met the minimum confidence threshold (&gt;= 30).
                        </div>
                    )}
                </div>

                {/* Right Column: 0DTE Alerts */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-300 border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-500" />
                            0DTE Scalps
                        </span>
                        <span className="text-xs font-mono text-slate-500 font-medium">Refreshes in {zeroDteTimer}s</span>
                    </h3>
                    {zeroDteAlerts.length === 0 ? (
                        <div className="bg-slate-900/50 rounded-3xl border border-slate-800/50 p-10 text-center h-[300px] flex flex-col items-center justify-center">
                            <Zap className="h-12 w-12 text-slate-600 mb-4 animate-pulse opacity-50" />
                            <h3 className="text-lg font-bold text-white mb-2">Awaiting 0DTE Signals</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                No highly volatile zero-day contracts found yet.
                            </p>
                        </div>
                    ) : (
                        zeroDteAlerts.map((alert, idx) => renderAlertCard(alert, idx))
                    )}
                    
                    {/* Status Box */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mt-8">
                        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-fuchsia-500" />
                            How This Works
                        </h3>
                        <div className="space-y-3 text-xs text-slate-400">
                            <p>
                                <strong className="text-white block">1. Quantitative Scan</strong>
                                Monitors watchlists for explosive options flow (Volume &gt; OI by 2.5x).
                            </p>
                            <p>
                                <strong className="text-white block">2. Qualitative Catalyst</strong>
                                Triggers an immediate scrape of the Yahoo Finance RSS feed.
                            </p>
                            <p>
                                <strong className="text-white block">3. VADER Sentiment Scoring</strong>
                                Uses NLP to score headlines from -1 to +1.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <InstitutionalFlowRadar onAddTrade={onAddTrade} />
            
            <LedgerPanel />
        </div>
    );
}
