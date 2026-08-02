import React, { useState } from "react";
import { Position } from "@/lib/types";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Trash2, Check, X, FileText, Brain, Activity, Edit2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PositionsTableProps {
    positions: Position[];
    onRemoveTrade: (id: string) => void;
    onSellTrade: (position: Position, price: number) => void;
    onReviewTrade: (position: Position) => void;
    onManualPriceUpdate: (id: string, price: number) => void;
}

export function PositionsTable({ positions, onRemoveTrade, onSellTrade, onReviewTrade, onManualPriceUpdate }: PositionsTableProps) {
    const [sellingId, setSellingId] = useState<string | null>(null);
    const [sellPrice, setSellPrice] = useState<string>("");

    // Manual Price Override State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<string>("");

    const startSelling = (pos: Position) => {
        setSellingId(pos.id);
        setSellPrice(pos.currentPrice?.toFixed(2) || "0.00");
    };

    const confirmSell = (pos: Position) => {
        const price = parseFloat(sellPrice);
        if (isNaN(price)) return;
        onSellTrade(pos, price);
        setSellingId(null);
        setSellPrice("");
    };

    const cancelSell = () => {
        setSellingId(null);
        setSellPrice("");
    };

    const startEditing = (pos: Position, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(pos.id);
        setEditPrice(pos.currentPrice?.toFixed(2) || "0.00");
    };

    const confirmEdit = (pos: Position, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        const price = parseFloat(editPrice);
        if (!isNaN(price) && price >= 0) {
            onManualPriceUpdate(pos.id, price);
        }
        setEditingId(null);
        setEditPrice("");
    };

    const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        setEditingId(null);
        setEditPrice("");
    };

    if (positions.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                <TrendingUp className="h-12 w-12 mx-auto text-slate-600 mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-slate-400">No active positions</h3>
                <p className="text-slate-500 mt-1">Add a trade to start tracking your portfolio.</p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-xl">

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-800/50">
                    {positions.map((pos) => {
                        const totalReturn = pos.pl;
                        const returnPercent = (pos.pl / (pos.premium * pos.quantity * 100)) * 100;
                        const isProfit = totalReturn >= 0;

                        return (
                            <div key={pos.id} className="p-4 space-y-3 bg-slate-950/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs text-cyan-400 font-mono border border-slate-700 font-bold">
                                            {pos.symbol.substring(0, 2)}
                                        </span>
                                        <div>
                                            <div className="font-bold text-white text-base">{pos.symbol}</div>
                                            <div className="text-xs text-slate-400">{pos.quantity}x {pos.type.toUpperCase()} @ {pos.strike}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-mono font-bold text-white">${pos.marketValue.toFixed(0)}</div>
                                        <div className={`text-xs font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
                                            {isProfit ? "+" : ""}{returnPercent.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-500 bg-slate-900/40 p-2 rounded-lg">
                                    <div>
                                        <span className="block text-[10px] uppercase text-slate-600">Premium</span>
                                        <span className="text-slate-300">${pos.premium.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase text-slate-600">Current</span>
                                        {editingId === pos.id ? (
                                            <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                                                <Input
                                                    type="number"
                                                    value={editPrice}
                                                    onChange={e => setEditPrice(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') confirmEdit(pos, e);
                                                        if (e.key === 'Escape') cancelEdit(e);
                                                    }}
                                                    className="h-5 w-14 text-[10px] px-1 bg-slate-950 border-cyan-500/50"
                                                    autoFocus
                                                />
                                                <button onClick={(e) => confirmEdit(pos, e)} className="text-green-400 hover:text-green-300">
                                                    <Check className="h-3 w-3" />
                                                </button>
                                                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-300">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span
                                                className="text-slate-300 flex items-center gap-1 cursor-pointer hover:text-cyan-400 group/edit"
                                                onClick={(e) => startEditing(pos, e)}
                                                title="Manually override price"
                                            >
                                                ${pos.currentPrice?.toFixed(2)}
                                                {pos.isManualOverride && <span className="text-[8px] text-cyan-500 font-bold mb-1">*</span>}
                                                <Edit2 className="h-3 w-3 opacity-50 group-hover/edit:opacity-100 text-cyan-500 transition-opacity ml-1" />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase text-slate-600">Exp</span>
                                        <span className="text-slate-300">{format(new Date(pos.expiration), "MMM d")}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase text-slate-600">Greeks</span>
                                        <span className="text-cyan-500/80">Δ {pos.greeks?.delta?.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
                                        onClick={() => onReviewTrade(pos)}
                                    >
                                        Review
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="w-10 px-0 opacity-70 hover:opacity-100"
                                        onClick={() => onRemoveTrade(pos.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/20"
                                        onClick={() => onSellTrade(pos, pos.currentPrice || 0)}
                                    >
                                        Sell
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Symbol</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Option</th>
                                <th className="px-6 py-4 text-right">Mkt Price</th>
                                <th className="px-6 py-4 text-right">Avg Cost</th>
                                <th className="px-6 py-4 text-right">Greeks (Δ/Θ)</th>
                                <th className="px-6 py-4 text-right">Mkt Value</th>
                                <th className="px-6 py-4 text-right">Return</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {positions.map((pos) => {
                                const totalReturn = pos.pl;
                                const returnPercent = (pos.pl / (pos.premium * pos.quantity * 100)) * 100;
                                const isProfit = totalReturn >= 0;
                                const isSelling = sellingId === pos.id;

                                return (
                                    <tr key={pos.id} onClick={() => onReviewTrade(pos)} className="hover:bg-cyan-950/10 transition-colors group cursor-pointer relative">
                                        <td className="px-6 py-4 font-bold text-white">
                                            <div className="flex items-center gap-2">
                                                <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-cyan-400 font-mono border border-slate-700">
                                                    {pos.symbol.substring(0, 2)}
                                                </span>
                                                <div>
                                                    <div>{pos.symbol}</div>
                                                    {pos.notes && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-normal cursor-help">
                                                                    <FileText className="h-3 w-3" /> Note
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-slate-900 border-slate-800 text-slate-300 max-w-xs">
                                                                <p>{pos.notes}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                            <div>{pos.entryDate ? format(new Date(pos.entryDate), "MMM d") : ""}</div>
                                            <div className="text-slate-500">{pos.entryTime}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className={`font-semibold ${pos.type === "Call" ? "text-green-400" : "text-red-400"}`}>
                                                    {pos.strike} {pos.type.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Exp: {format(new Date(pos.expiration), "MMM d, yyyy")}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                                            {editingId === pos.id ? (
                                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                    <Input
                                                        type="number"
                                                        value={editPrice}
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') confirmEdit(pos, e);
                                                            if (e.key === 'Escape') cancelEdit(e);
                                                        }}
                                                        className="h-6 w-20 text-xs px-2 bg-slate-950 border-cyan-500/50 text-right"
                                                        autoFocus
                                                    />
                                                    <button onClick={(e) => confirmEdit(pos, e)} className="text-green-400 hover:text-green-300 bg-green-500/10 p-1 rounded">
                                                        <Check className="h-3 w-3" />
                                                    </button>
                                                    <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-300 bg-slate-800 p-1 rounded">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center justify-end gap-1.5 cursor-pointer group/edit hover:text-cyan-400"
                                                    onClick={(e) => startEditing(pos, e)}
                                                    title="Manually override price"
                                                >
                                                    ${pos.currentPrice?.toFixed(2) || "0.00"}
                                                    {pos.isManualOverride && <span className="text-[10px] text-cyan-500 font-bold font-sans self-start">*</span>}
                                                    <Edit2 className="h-3 w-3 opacity-50 group-hover/edit:opacity-100 text-cyan-500 transition-opacity ml-1" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-400">
                                            ${pos.premium.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <div className="flex flex-col items-end">
                                                <span className="text-cyan-400 text-xs font-bold">Δ {pos.greeks?.delta?.toFixed(2) || "0.00"}</span>
                                                <span className="text-slate-500 text-[10px]">Θ {pos.greeks?.theta?.toFixed(2) || "0.00"}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-medium text-white">
                                            ${pos.marketValue.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`flex items-center justify-end gap-1 font-bold ${isProfit ? "text-green-400 shadow-green-500/20 drop-shadow-sm" : "text-red-400 shadow-red-500/20 drop-shadow-sm"}`}>
                                                {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                <span>${Math.abs(totalReturn).toFixed(2)}</span>
                                            </div>
                                            <div className={`text-xs text-right mt-1 ${isProfit ? "text-green-500/70" : "text-red-500/70"}`}>
                                                {returnPercent > 0 ? "+" : ""}{returnPercent.toFixed(2)}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isSelling ? (
                                                <div className="flex flex-col items-end gap-1 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="text-xs text-slate-500 font-mono">x{pos.quantity}</span>
                                                        <Input
                                                            type="number"
                                                            value={sellPrice}
                                                            onChange={(e) => setSellPrice(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') confirmSell(pos);
                                                                if (e.key === 'Escape') cancelSell();
                                                            }}
                                                            className="w-24 h-8 bg-slate-950 border-cyan-500/50 focus:ring-0 text-right"
                                                            autoFocus
                                                        />
                                                        <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-500" onClick={(e) => { e.stopPropagation(); confirmSell(pos); }}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); cancelSell(); }}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Est. Total: ${((parseFloat(sellPrice) || 0) * pos.quantity * 100).toFixed(2)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`font-black tracking-tighter uppercase text-[10px] border px-3 h-8 shadow-sm transition-all duration-300 ${pos.recommendation?.color === "green" ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20" :
                                                            pos.recommendation?.color === "orange" ? "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20" :
                                                                pos.recommendation?.color === "red" ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20" :
                                                                    pos.recommendation?.color === "purple" ? "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20" :
                                                                        pos.recommendation?.color === "emerald" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" :
                                                                            pos.recommendation?.color === "rose" ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20" :
                                                                                "bg-cyan-900/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-900/30"
                                                            }`}
                                                        onClick={(e) => { e.stopPropagation(); onReviewTrade(pos); }}
                                                    >
                                                        <Activity className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                                                        {pos.recommendation?.signal ? `Pulse: ${pos.recommendation.signal}` : "Pulse Review"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 border border-cyan-500/20 z-10 relative"
                                                        onClick={(e) => { e.stopPropagation(); startSelling(pos); }}
                                                    >
                                                        Sell
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); onRemoveTrade(pos.id); }}
                                                        className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-70 hover:opacity-100 transition-opacity z-10 relative"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
        </TooltipProvider>
    );
}
