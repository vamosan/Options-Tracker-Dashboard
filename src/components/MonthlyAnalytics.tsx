"use client";

import React, { useState, useMemo } from "react";
import { Position } from "@/lib/types";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    parseISO,
    subMonths,
    isSameMonth,
    addMonths
} from "date-fns";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    Target,
    Zap,
    Trophy,
    X,
    LayoutGrid,
    List,
    History
} from "lucide-react";
import { Button } from "./ui/button";

interface MonthlyAnalyticsProps {
    isOpen: boolean;
    onClose: () => void;
    closedPositions: Position[];
}

export function MonthlyAnalytics({ isOpen, onClose, closedPositions }: MonthlyAnalyticsProps) {
    const [viewDate, setViewDate] = useState(new Date());
    const [displayMode, setDisplayMode] = useState<"grid" | "list">("list");

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Group realized P&L by day for the selected month
    const dailyStats = useMemo(() => {
        const stats: Record<string, number> = {};

        closedPositions.forEach(pos => {
            if (!pos.entryDate) return;
            const date = parseISO(pos.entryDate);
            if (isSameMonth(date, viewDate)) {
                const dateKey = format(date, "yyyy-MM-dd");
                stats[dateKey] = (stats[dateKey] || 0) + (pos.realizedPl || 0);
            }
        });

        return stats;
    }, [closedPositions, viewDate]);

    // Monthly aggregates
    const monthAggregates = useMemo(() => {
        const values = Object.values(dailyStats);
        const totalPL = values.reduce((sum, val) => sum + val, 0);
        const profitableDays = values.filter(v => v > 0).length;
        const totalTradingDays = values.length;
        const winRate = totalTradingDays > 0 ? (profitableDays / totalTradingDays) * 100 : 0;

        let bestDay = { date: "", profit: -Infinity };
        Object.entries(dailyStats).forEach(([date, profit]) => {
            if (profit > bestDay.profit) {
                bestDay = { date, profit };
            }
        });

        return {
            totalPL,
            winRate,
            profitableDays,
            totalTradingDays,
            bestDay: bestDay.profit === -Infinity ? null : bestDay
        };
    }, [dailyStats]);

    if (!isOpen) return null;

    const isMonthProfit = monthAggregates.totalPL >= 0;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl transition-all duration-500"
                onClick={onClose}
            />

            {/* Main Window */}
            <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                {/* Header Decoration */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

                {/* Header */}
                <div className="p-8 pb-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/20">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-inner shadow-emerald-500/5">
                            <Calendar className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                                    {format(viewDate, "MMMM yyyy")}
                                </h2>
                                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewDate(subMonths(viewDate, 1))}
                                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4 text-slate-400" />
                                    </button>
                                    <button
                                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                Performance Analytics • Session Tracking
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setDisplayMode("list")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${displayMode === "list" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                <List className="h-3 w-3" /> List
                            </button>
                            <button
                                onClick={() => setDisplayMode("grid")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${displayMode === "grid" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                <LayoutGrid className="h-3 w-3" /> Grid
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-10 w-10 rounded-full border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors"
                        >
                            <X className="h-5 w-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Summary Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 rounded-3xl bg-slate-950/40 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly P&L</p>
                                <Zap className={`h-4 w-4 ${isMonthProfit ? "text-emerald-400" : "text-rose-400"}`} />
                            </div>
                            <h3 className={`text-3xl font-black italic tracking-tighter ${isMonthProfit ? "text-emerald-400" : "text-rose-400"}`}>
                                {isMonthProfit ? "+" : ""}${Math.abs(monthAggregates.totalPL).toFixed(2)}
                            </h3>
                        </div>

                        <div className="p-6 rounded-3xl bg-slate-950/40 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Win Rate</p>
                                <Target className="h-4 w-4 text-cyan-400" />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tighter text-white">
                                {monthAggregates.winRate.toFixed(1)}%
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{monthAggregates.profitableDays} / {monthAggregates.totalTradingDays} Green Days</p>
                        </div>

                        <div className="p-6 rounded-3xl bg-slate-950/40 border border-white/5 space-y-2 col-span-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Best Session</p>
                                <Trophy className="h-4 w-4 text-yellow-500" />
                            </div>
                            {monthAggregates.bestDay ? (
                                <div className="flex items-end justify-between">
                                    <div>
                                        <h3 className="text-3xl font-black italic tracking-tighter text-white">
                                            +${monthAggregates.bestDay.profit.toFixed(2)}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                                            {format(parseISO(monthAggregates.bestDay.date), "EEEE, MMM do")}
                                        </p>
                                    </div>
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-[10px] text-yellow-500 font-black uppercase">
                                        Alpha Day
                                    </div>
                                </div>
                            ) : (
                                <h3 className="text-3xl font-black italic tracking-tighter text-slate-600">No Data</h3>
                            )}
                        </div>
                    </div>

                    {displayMode === "list" ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-4 px-6 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                <div>Date</div>
                                <div>Status</div>
                                <div className="text-right">Realized P&L</div>
                                <div className="text-right">Volatility</div>
                            </div>
                            <div className="space-y-2">
                                {daysInMonth.reverse().filter(day => dailyStats[format(day, "yyyy-MM-dd")] !== undefined).map(day => {
                                    const dateKey = format(day, "yyyy-MM-dd");
                                    const profit = dailyStats[dateKey];
                                    const isProfit = profit >= 0;

                                    return (
                                        <div key={dateKey} className="grid grid-cols-4 items-center bg-slate-950/20 hover:bg-slate-800/20 border border-white/5 px-6 py-4 rounded-2xl transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center font-black">
                                                    <span className="text-[10px] text-slate-500 leading-none">{format(day, "MMM")}</span>
                                                    <span className="text-sm text-white leading-none mt-1">{format(day, "dd")}</span>
                                                </div>
                                                <div className="text-xs font-bold text-slate-300">
                                                    {format(day, "EEEE")}
                                                </div>
                                            </div>
                                            <div>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${isProfit ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                                                    {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {isProfit ? "Profitable" : "Negative"}
                                                </div>
                                            </div>
                                            <div className={`text-right text-lg font-black italic tracking-tight ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                                                {isProfit ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                                            </div>
                                            <div className="text-right">
                                                <div className="h-1.5 w-24 bg-slate-800 rounded-full ml-auto overflow-hidden">
                                                    <div className={`h-full rounded-full ${isProfit ? "bg-emerald-500" : "bg-rose-500 opacity-50"}`} style={{ width: `${Math.min(100, (Math.abs(profit) / (monthAggregates.bestDay?.profit || 1)) * 100)}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.keys(dailyStats).length === 0 && (
                                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950/10 border border-slate-800/50 border-dashed rounded-[2.5rem]">
                                        <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center">
                                            <History className="h-8 w-8 text-slate-700" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-500 uppercase tracking-tighter italic">No History Found</h4>
                                            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-1">No closed trades recorded for this month</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-3">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                <div key={d} className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest pb-4">{d}</div>
                            ))}
                            {/* Empty cells before the start of the month */}
                            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square rounded-3xl bg-transparent" />
                            ))}
                            {daysInMonth.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const profit = dailyStats[dateKey];
                                const hasData = profit !== undefined;
                                const isProfit = profit > 0;

                                return (
                                    <div
                                        key={dateKey}
                                        className={`aspect-square rounded-3xl border flex flex-col items-center justify-center transition-all p-2 relative overflow-hidden group ${hasData
                                            ? isProfit
                                                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                                                : "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
                                            : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                                            }`}
                                    >
                                        <div className="absolute top-3 left-4 text-[10px] font-black text-slate-500">{format(day, "d")}</div>
                                        {hasData && (
                                            <>
                                                <div className={`text-xs font-black italic tracking-tight ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                                                    {isProfit ? "+" : ""}${Math.abs(profit).toFixed(0)}
                                                </div>
                                                <div className={`mt-1 h-1 w-8 rounded-full ${isProfit ? "bg-emerald-500" : "bg-rose-500"}`} />
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-950/40 border-t border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Profitable Day</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Negative Day</span>
                        </div>
                    </div>
                    <Button variant="outline" onClick={onClose} className="border-slate-800 text-slate-400 hover:bg-slate-800 rounded-xl px-10">
                        Close Analytics
                    </Button>
                </div>
            </div>
        </div>
    );
}
