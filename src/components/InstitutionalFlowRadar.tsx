"use client";

import React, { useState, useEffect } from "react";
import { Activity, Zap, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Target } from "lucide-react";
import { motion } from "framer-motion";

interface FlowData {
    id: string;
    symbol: string;
    contractSymbol: string;
    type: string;
    strike: number;
    expiration: string;
    volume: number;
    openInterest: number;
    lastPrice: number;
    underlyingPrice: number;
    premiumTraded: number;
    isPositioning: boolean;
    impliedVolatility: number;
    sweepType: string;
    isOtm: boolean;
    moneyness: string;
    timestamp: string;
}

export function InstitutionalFlowRadar({ onAddTrade }: { onAddTrade?: (trade: any) => void }) {
    const [flows, setFlows] = useState<FlowData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const fetchFlows = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/scanner/flow");
            if (res.ok) {
                const data = await res.json();
                setFlows(data);
                setLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (err) {
            console.error("Failed to fetch institutional flow", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlows();
        const interval = setInterval(fetchFlows, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, []);

    const formatMoney = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val.toFixed(0)}`;
    };

    const handleCopy = (symbol: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(symbol);
            alert(`Copied contract symbol: ${symbol}`);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Target className="w-48 h-48 text-cyan-500" />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10 border-b border-slate-800 pb-4">
                <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                        <Activity className="h-6 w-6 text-cyan-500" />
                        Smart Money Radar
                    </h3>
                    <p className="text-sm text-slate-400">Institutional Block Trades & Unusual Positioning (&gt;$1M Premium)</p>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-full mb-1">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        Live Core Basket Scanner
                    </div>
                    {lastUpdated && <span className="text-[10px] text-slate-500">Updated: {lastUpdated}</span>}
                </div>
            </div>

            <div className="relative z-10 overflow-x-auto">
                {loading && flows.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-cyan-500/50">
                        <Activity className="h-10 w-10 animate-pulse mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest">Scanning Options Chains...</p>
                    </div>
                ) : flows.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                        <AlertCircle className="h-10 w-10 mb-4 opacity-30" />
                        <p className="text-sm font-bold uppercase tracking-widest">No Whale Blocks Detected</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-800">
                                <th className="pb-3 px-2">Ticker</th>
                                <th className="pb-3 px-2">Contract</th>
                                <th className="pb-3 px-2 text-right">Premium</th>
                                <th className="pb-3 px-2 text-right">Vol / OI</th>
                                <th className="pb-3 px-2 text-center">Type</th>
                                <th className="pb-3 px-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {flows.map((flow) => {
                                const isBull = flow.sweepType === "BULLISH";
                                const isBear = flow.sweepType === "BEARISH";
                                
                                return (
                                    <tr key={flow.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="py-4 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                                    isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                                    isBear ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                                    'bg-slate-800 text-slate-300'
                                                }`}>
                                                    {isBull ? <ArrowUpRight className="h-4 w-4" /> : isBear ? <ArrowDownRight className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <div className="font-black text-white text-base">{flow.symbol}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono">${flow.underlyingPrice.toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="font-bold text-slate-300">${flow.strike} {flow.type}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">Exp: {new Date(flow.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <div className="font-black text-white text-lg">{formatMoney(flow.premiumTraded)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{flow.isPositioning ? 'Position Value' : 'Traded Value'}</div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <div className="font-bold text-slate-300">{flow.volume.toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">OI: {flow.openInterest.toLocaleString()}</div>
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                                isBull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                                isBear ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                                'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}>
                                                {flow.sweepType}
                                            </span>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <button 
                                                onClick={() => handleCopy(flow.contractSymbol)}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border border-slate-700 hover:border-cyan-500/50"
                                            >
                                                Copy
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
