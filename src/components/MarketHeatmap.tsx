"use client";

import React, { useState } from "react";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import useSWR from 'swr';
import { StockHistoryModal } from "./StockHistoryModal";

export function MarketHeatmap() {
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const fetcher = (url: string) => fetch(url).then(res => res.json());
    const { data: tickersData, error } = useSWR('/api/heatmap', fetcher, {
        refreshInterval: 15000,
        revalidateOnFocus: false
    });

    const tickers = Array.isArray(tickersData) ? tickersData : [];

    if (error) {
        return (
            <div className="w-full bg-red-950/20 border border-red-900/50 rounded-2xl h-24 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-red-400 font-mono">Heatmap Feed Interrupted</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Retrying...</span>
                </div>
            </div>
        );
    }

    if (tickers.length === 0) {
        return (
            <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-2xl h-24 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Activity className="h-5 w-5 animate-pulse text-cyan-500/80" />
                    <span className="text-xs text-slate-500 font-mono">Loading Heatmap...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h2 className="text-xl font-bold text-white tracking-tight mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" /> Market Heatmap
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 ml-2">Top 10 Volume</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {tickers.map((ticker, i) => {
                    const pct = ticker.changePercent || 0;
                    const change = ticker.change || 0;
                    const isPositive = pct >= 0;

                    return (
                        <div
                            key={`${ticker.symbol}-${i}`}
                            onClick={() => setSelectedSymbol(ticker.symbol)}
                            className={`relative overflow-hidden rounded-xl border p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] shadow-lg cursor-pointer active:scale-95
                                ${isPositive
                                    ? "bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-900/10"
                                    : "bg-red-950/40 border-red-500/30 hover:border-red-500/60 shadow-red-900/10"
                                }`
                            }
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-extrabold text-white text-sm tracking-tight">{ticker.symbol}</span>
                                <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white backdrop-blur-sm shadow-sm
                                        ${isPositive ? "bg-emerald-500/30" : "bg-red-500/30"}`
                                }
                                >
                                    {isPositive ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                    {Math.abs(pct).toFixed(2)}%
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-lg font-mono font-bold text-white">${ticker.price?.toFixed(2)}</span>
                                <span className={`text-[10px] font-mono ${isPositive ? "text-emerald-400/80" : "text-red-400/80"}`}>
                                    {isPositive ? "+" : ""}{change.toFixed(2)} Today
                                </span>
                            </div>

                            {/* Decorative background gradient element */}
                            <div className={`absolute -bottom-6 -right-6 w-20 h-20 blur-2xl rounded-full opacity-20 pointer-events-none 
                                ${isPositive ? "bg-emerald-400" : "bg-red-400"}`
                            } />
                        </div>
                    );
                })}
            </div>

            <StockHistoryModal
                symbol={selectedSymbol}
                onClose={() => setSelectedSymbol(null)}
            />
        </div>
    );
}
