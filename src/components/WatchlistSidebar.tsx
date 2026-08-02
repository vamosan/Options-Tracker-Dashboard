"use client";

import React, { useEffect, useState } from "react";
import { fetchStockPrice } from "@/app/actions";
import { ArrowUpRight, ArrowDownRight, X, RefreshCw, BarChart2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TickerPrice {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
}

interface WatchlistSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTickers: string[];
}

export function WatchlistSidebar({ isOpen, onClose, activeTickers }: WatchlistSidebarProps) {
    const [prices, setPrices] = useState<Record<string, TickerPrice>>({});
    const [loading, setLoading] = useState(false);

    const updateWatchlist = async () => {
        if (activeTickers.length === 0) return;
        setLoading(true);
        const newPrices: Record<string, TickerPrice> = {};

        await Promise.all(
            activeTickers.map(async (symbol) => {
                const data = await fetchStockPrice(symbol);
                if (data) {
                    newPrices[symbol] = {
                        symbol,
                        ...data
                    };
                }
            })
        );

        setPrices(newPrices);
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            updateWatchlist();
            const interval = setInterval(updateWatchlist, 30000); // Update every 30s
            return () => clearInterval(interval);
        }
    }, [isOpen, activeTickers]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-slate-950/90 border-l border-slate-800 backdrop-blur-xl z-50 shadow-2xl transition-transform duration-300 transform translate-x-0">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-xl font-bold text-white tracking-tight">Market Pulse</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="h-5 w-5 text-slate-400" />
                </button>
            </div>

            <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-4">
                    {activeTickers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                                <BarChart2 className="h-6 w-6 text-slate-700" />
                            </div>
                            <p className="text-slate-500 text-sm">Add trades to monitor<br />active tickers</p>
                        </div>
                    ) : (
                        activeTickers.map((symbol) => {
                            const data = prices[symbol];
                            return (
                                <div
                                    key={symbol}
                                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                                            {symbol}
                                        </span>
                                        {data && (
                                            <span className={`flex items-center gap-1 text-sm font-medium ${data.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                {data.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                {Math.abs(data.changePercent).toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-slate-500 uppercase font-mono">
                                            {symbol === "SPY" || symbol === "QQQ" ? "Index ETF" : "Equity"}
                                        </span>
                                        {data ? (
                                            <span className="text-2xl font-mono font-bold text-white">
                                                ${data.price.toFixed(2)}
                                            </span>
                                        ) : (
                                            <div className="h-8 w-24 bg-slate-800 animate-pulse rounded" />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-4">
                        <RefreshCw className="h-4 w-4 text-cyan-400 animate-spin" />
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
