"use client";

import React, { useState, useEffect } from "react";
import { Activity, Zap, Newspaper, TrendingUp, AlertCircle, Clock, ExternalLink } from "lucide-react";

export function PreMarketWatchlist() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await fetch('/api/premarket');
                const json = await res.json();
                if (json.success && isMounted) {
                    setData(json.data);
                } else if (isMounted) {
                    setError(json.error || "Failed to fetch premarket data");
                }
            } catch (err: any) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, []);

    return (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.1)] relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap className="w-32 h-32 text-emerald-500" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <Activity className="h-6 w-6 text-emerald-400" />
                    <h3 className="text-2xl font-black text-white">Daily Catalyst & Breakout Watchlist</h3>
                </div>
                <p className="text-sm text-slate-400 mb-8 max-w-2xl">
                    Intelligently tracking top pre-market movers, cross-referencing breaking news catalysts, and grading breakout potential using our multi-pillar agentic scoring engine.
                </p>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-emerald-400">
                        <Activity className="h-10 w-10 mb-4 animate-pulse" />
                        <p className="text-sm font-bold animate-pulse tracking-widest uppercase">Scanning Markets & Aggregating Catalysts...</p>
                    </div>
                )}

                {error && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-10 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                {!isLoading && !error && data.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        <p>No significant movers detected right now.</p>
                    </div>
                )}

                {!isLoading && !error && data.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {data.map((item, index) => {
                            const score = item.score?.pillar_total || 0;
                            const isGreen = score > 0;
                            const isRed = score < 0;
                            const isNeutral = score === 0;

                            return (
                                <div key={item.symbol} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row gap-6 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                                    {/* Score Indicator Strip */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80" style={{
                                        backgroundColor: isGreen ? '#10b981' : isRed ? '#f43f5e' : '#f59e0b'
                                    }}></div>

                                    {/* Mover Info */}
                                    <div className="flex flex-col min-w-[200px]">
                                        <div className="flex items-end gap-3 mb-1">
                                            <h4 className="text-3xl font-black text-white">{item.symbol}</h4>
                                            <div className={`text-lg font-bold ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className="text-sm font-mono text-slate-400 mb-2">
                                            ${item.price.toFixed(2)} • Vol: {(item.volume / 1000000).toFixed(1)}M
                                        </div>
                                        <div className={`inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                                            isGreen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                            isRed ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        }`}>
                                            <Zap className="h-3 w-3" />
                                            {isGreen ? 'High Breakout Potential' : isRed ? 'Low Conviction' : 'Observe / Wait'}
                                        </div>
                                    </div>

                                    {/* Catalyst Info */}
                                    <div className="flex-1 bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                            <Newspaper className="h-4 w-4 text-blue-400" /> Catalyst / News
                                        </div>
                                        {item.catalyst ? (
                                            <div>
                                                <a href={item.catalyst.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-300 hover:text-blue-200 hover:underline flex items-start gap-2">
                                                    {item.catalyst.headline}
                                                    <ExternalLink className="h-3 w-3 flex-shrink-0 mt-1 opacity-50" />
                                                </a>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-mono">
                                                    <span>{item.catalyst.source}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.catalyst.time}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No major recent catalysts detected. Move may be technical.</p>
                                        )}
                                    </div>

                                    {/* Agentic Desk Summary */}
                                    <div className="lg:w-[350px] bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                            <TrendingUp className="h-4 w-4 text-indigo-400" /> Agentic Rationale
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {item.score?.decision?.rationale || "Agentic analysis unavailable for this ticker."}
                                        </p>
                                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800">
                                            <div className="text-xs">
                                                <span className="text-slate-500">Trend: </span>
                                                <span className={item.score?.pillars?.trend?.score > 0 ? 'text-emerald-400 font-bold' : item.score?.pillars?.trend?.score < 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>{item.score?.pillars?.trend?.score || 0}</span>
                                            </div>
                                            <div className="text-xs">
                                                <span className="text-slate-500">Mom: </span>
                                                <span className={item.score?.pillars?.momentum?.score > 0 ? 'text-emerald-400 font-bold' : item.score?.pillars?.momentum?.score < 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>{item.score?.pillars?.momentum?.score || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
