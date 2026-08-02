import React from 'react';
import { Position } from '@/lib/types';
import { Target, Activity, Flame, Skull, TrendingUp, TrendingDown } from 'lucide-react';

interface TradePerformanceSummaryProps {
    closedPositions: Position[];
}

export function TradePerformanceSummary({ closedPositions }: TradePerformanceSummaryProps) {
    if (closedPositions.length === 0) return null;

    const winningTrades = closedPositions.filter(p => (p.realizedPl || 0) > 0);
    const losingTrades = closedPositions.filter(p => (p.realizedPl || 0) <= 0); // Include breakeven as non-win
    
    const winRate = (winningTrades.length / closedPositions.length) * 100;
    
    const sortedByPnL = [...closedPositions].sort((a, b) => (b.realizedPl || 0) - (a.realizedPl || 0));
    const topGainer = sortedByPnL[0];
    const topLoser = sortedByPnL[sortedByPnL.length - 1];

    const totalRealized = closedPositions.reduce((sum, p) => sum + (p.realizedPl || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all hover:bg-slate-900/80">
                <div className="absolute -top-4 -right-4 p-4 opacity-5 rotate-12">
                    <Target className="h-32 w-32" />
                </div>
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> Signal Success Rate
                </h3>
                <div className={`text-4xl font-black tracking-tighter ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {winRate.toFixed(1)}%
                </div>
                <div className="text-slate-500 text-xs mt-3 font-bold bg-slate-950/50 inline-block px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-green-400">{winningTrades.length} Wins</span> <span className="mx-1 text-slate-700">|</span> <span className="text-red-400">{losingTrades.length} Losses</span>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all hover:bg-slate-900/80">
                <div className="absolute -top-4 -right-4 p-4 opacity-5 rotate-12">
                    <Activity className="h-32 w-32" />
                </div>
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Activity className="h-4 w-4" /> Realized Return
                </h3>
                <div className={`text-4xl font-black tracking-tighter ${totalRealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalRealized >= 0 ? '+' : '-'}${Math.abs(totalRealized).toFixed(2)}
                </div>
                <div className="text-slate-500 text-xs mt-3 font-bold bg-slate-950/50 inline-block px-3 py-1.5 rounded-lg border border-slate-800">
                    Across {closedPositions.length} completed trades
                </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all hover:bg-emerald-900/20">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 rotate-12">
                    <Flame className="h-32 w-32 text-emerald-500" />
                </div>
                <h3 className="text-emerald-500/70 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> Top Gainer
                </h3>
                {topGainer && (topGainer.realizedPl || 0) > 0 ? (
                    <>
                        <div className="text-4xl font-black tracking-tighter text-emerald-400">
                            +${topGainer.realizedPl?.toFixed(2)}
                        </div>
                        <div className="text-emerald-400/80 text-xs mt-3 font-bold bg-emerald-950/50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] uppercase">
                                {topGainer.symbol}
                            </span>
                            {topGainer.type} @ ${topGainer.strike}
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 text-sm mt-3 font-medium">No winning trades yet</div>
                )}
            </div>

            <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all hover:bg-red-900/20">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 rotate-12">
                    <Skull className="h-32 w-32 text-red-500" />
                </div>
                <h3 className="text-red-500/70 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" /> Top Loser
                </h3>
                {topLoser && (topLoser.realizedPl || 0) < 0 ? (
                    <>
                        <div className="text-4xl font-black tracking-tighter text-red-400">
                            -${Math.abs(topLoser.realizedPl || 0).toFixed(2)}
                        </div>
                        <div className="text-red-400/80 text-xs mt-3 font-bold bg-red-950/50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/50">
                            <span className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded text-[10px] uppercase">
                                {topLoser.symbol}
                            </span>
                            {topLoser.type} @ ${topLoser.strike}
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 text-sm mt-3 font-medium">No losing trades yet</div>
                )}
            </div>
        </div>
    );
}
