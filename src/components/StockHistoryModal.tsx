"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Maximize2, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Button } from "./ui/button";
import {
    ComposedChart,
    Area,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

interface StockHistoryModalProps {
    symbol: string | null;
    onClose: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function StockHistoryModal({ symbol, onClose }: StockHistoryModalProps) {
    const [timeframe, setTimeframe] = React.useState<'1d' | '1w' | '30d'>('30d');
    const [showIndicators, setShowIndicators] = React.useState(true);

    const { data, error, isLoading } = useSWR(
        symbol ? `/api/history?symbol=${symbol}&timeframe=${timeframe}` : null,
        fetcher
    );

    const history = data?.history || [];
    const currentPrice = data?.currentPrice || 0;
    const isPositive = (history[history.length - 1]?.price || 0) >= (history[0]?.price || 0);

    return (
        <AnimatePresence>
            {symbol && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-[101] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                    {isPositive ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                        {symbol}
                                        <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 uppercase">
                                            {timeframe} Analytics
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={() => setShowIndicators(!showIndicators)}
                                    className={`text-[10px] font-black uppercase tracking-widest h-8 rounded-lg ${showIndicators ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    Indicators: {showIndicators ? 'ON' : 'OFF'}
                                </Button>
                                <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
                                    {(['1d', '1w', '30d'] as const).map(tf => (
                                        <button
                                            key={tf}
                                            onClick={() => setTimeframe(tf)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeframe === tf ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            {tf.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {isLoading ? (
                                <div className="h-[450px] flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
                                </div>
                            ) : error ? (
                                <div className="h-[450px] flex items-center justify-center text-red-400 font-mono text-xs uppercase">
                                    API Synchronization Error
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Main Price Chart */}
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={history}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                                <XAxis dataKey="date" hide />
                                                <YAxis hide domain={['auto', 'auto']} />
                                                <YAxis yAxisId="vol" hide orientation="right" domain={['auto', 'auto']} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                                    itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', paddingTop: '10px' }} />
                                                <Area yAxisId={0} name="Price" type="monotone" dataKey="price" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                                                {showIndicators && timeframe === '30d' && (
                                                    <>
                                                        <Line name="SMA 50" type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                                        <Line name="SMA 200" type="monotone" dataKey="sma200" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                                    </>
                                                )}
                                                <Bar yAxisId="vol" name="Volume" dataKey="volume" fill="#334155" opacity={0.3} barSize={10} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* RSI Mini Chart */}
                                    {showIndicators && (
                                        <div className="h-[80px] w-full border-t border-slate-800 pt-4">
                                            <div className="flex items-center justify-between mb-1 px-2">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RSI Indicator (14)</span>
                                                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Relative Strength</span>
                                            </div>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={history}>
                                                    <XAxis dataKey="date" hide />
                                                    <YAxis domain={[0, 100]} hide />
                                                    <Tooltip contentStyle={{ display: 'none' }} />
                                                    <Line type="monotone" dataKey="rsi" stroke="#06b6d4" dot={false} strokeWidth={2} />
                                                    {/* Overbought/Oversold levels */}
                                                    <Line dataKey={() => 70} stroke="#ef4444" strokeDasharray="3 3" dot={false} />
                                                    <Line dataKey={() => 30} stroke="#10b981" strokeDasharray="3 3" dot={false} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-slate-950/40 border-t border-slate-800 flex justify-between items-center">
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Current Price</p>
                                    <p className="text-xl font-black text-white italic">${currentPrice.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">{timeframe.toUpperCase()} Low</p>
                                    <p className="text-xl font-black text-white italic">
                                        ${history.length > 0 ? Math.min(...history.map((q: any) => q.price)).toFixed(2) : "0.00"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">{timeframe.toUpperCase()} High</p>
                                    <p className="text-xl font-black text-white italic">
                                        ${history.length > 0 ? Math.max(...history.map((q: any) => q.price)).toFixed(2) : "0.00"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg"
                            >
                                Close View
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
