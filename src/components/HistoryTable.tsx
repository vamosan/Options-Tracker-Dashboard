import React from "react";
import { Position } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowDownRight, History, Trash2, Calendar, FileText, Pencil, Brain, Save, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { updateTradeNotes, getJournalReflection } from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";

interface HistoryTableProps {
    closedPositions: Position[];
    onDeleteHistory: (id: string) => void;
    onUpdateHistory?: () => void;
}

export function HistoryTable({ closedPositions, onDeleteHistory, onUpdateHistory }: HistoryTableProps) {
    const [editingTrade, setEditingTrade] = React.useState<Position | null>(null);
    const [notes, setNotes] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);
    const [reflection, setReflection] = React.useState<string | null>(null);
    const [isReflecting, setIsReflecting] = React.useState(false);

    if (closedPositions.length === 0) return null;

    const handleOpenJournal = (trade: Position) => {
        setEditingTrade(trade);
        setNotes(trade.notes || "");
        setReflection(null);
    };

    const handleSaveNotes = async () => {
        if (!editingTrade) return;
        setIsSaving(true);
        try {
            await updateTradeNotes(editingTrade.id, notes);
            if (onUpdateHistory) onUpdateHistory();
            setEditingTrade(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGetReflection = async () => {
        if (!editingTrade) return;
        setIsReflecting(true);
        try {
            const res = await getJournalReflection(editingTrade, notes);
            setReflection(res);
        } catch (e) {
            console.error(e);
        } finally {
            setIsReflecting(false);
        }
    };

    // Group positions by Entry Date
    const groupedPositions = closedPositions.reduce((groups, pos) => {
        const date = pos.entryDate ? format(new Date(pos.entryDate), "yyyy-MM-dd") : "Unknown";
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(pos);
        return groups;
    }, {} as Record<string, Position[]>);

    // Sort dates descending
    const sortedDates = Object.keys(groupedPositions).sort((a, b) => b.localeCompare(a));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-slate-400">
                <History className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Trade History</h2>
            </div>

            <div className="space-y-6">
                {sortedDates.map((date) => {
                    const positions = groupedPositions[date];
                    const dailyTotal = positions.reduce((sum, p) => sum + (p.realizedPl || 0), 0);
                    const isDailyProfit = dailyTotal >= 0;

                    return (
                        <div key={date} className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-900/60 px-6 py-4 rounded-xl border border-slate-800 shadow-lg shadow-black/20">
                                <div className="flex items-center gap-3">
                                    <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                                        <Calendar className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <div className="text-lg font-bold text-white tracking-tight">
                                        {date === "Unknown" ? "Unknown Date" : format(parseISO(date), "EEEE, MMMM d, yyyy")}
                                    </div>
                                </div>
                                <div className={`flex flex-col items-end`}>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Session realized P&L</div>
                                    <div className={`text-xl font-black flex items-center gap-2 ${isDailyProfit ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]"}`}>
                                        {isDailyProfit ? "+" : "-"}${Math.abs(dailyTotal).toFixed(2)}
                                        {isDailyProfit ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/20 backdrop-blur-sm overflow-hidden">

                                {/* Mobile History Card */}
                                <div className="md:hidden divide-y divide-slate-800/30">
                                    {groupedPositions[date].map((pos) => {
                                        const realizedPl = pos.realizedPl || 0;
                                        const isProfit = realizedPl >= 0;
                                        const costBasis = pos.premium * pos.quantity * 100;
                                        const returnPercent = costBasis > 0 ? (realizedPl / costBasis) * 100 : 0;

                                        return (
                                            <div key={pos.id} className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${isProfit ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                                        {isProfit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-sm">{pos.symbol}</div>
                                                        <div className="text-xs text-slate-500 text-[10px]">{pos.quantity}x {pos.type} @ ${pos.exitPrice?.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-bold font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
                                                        {isProfit ? "+" : "-"}${Math.abs(realizedPl).toFixed(2)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-600">
                                                        {returnPercent.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm text-left opacity-90 transition-opacity">
                                        <thead className="bg-slate-950/30 text-slate-500 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4">Symbol</th>
                                                <th className="px-6 py-4">Option</th>
                                                <th className="px-6 py-4 text-right">Time</th>
                                                <th className="px-6 py-4 text-right">Entry Price</th>
                                                <th className="px-6 py-4 text-right">Exit Price</th>
                                                <th className="px-6 py-4 text-right">Realized P&L</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/30">
                                            {groupedPositions[date].map((pos) => {
                                                const realizedPl = pos.realizedPl || 0;
                                                const isProfit = realizedPl >= 0;

                                                // Calculate P&L %
                                                // Cost Basis = Premium * Quantity * 100
                                                const costBasis = pos.premium * pos.quantity * 100;
                                                const returnPercent = costBasis > 0 ? (realizedPl / costBasis) * 100 : 0;

                                                return (
                                                    <tr key={pos.id} className="hover:bg-slate-800/20 transition-colors group">
                                                        <td className="px-6 py-4 font-bold text-slate-300">
                                                            <div className="flex items-center gap-2">
                                                                <div>
                                                                    <div>{pos.symbol}</div>
                                                                    {pos.notes && (
                                                                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-normal cursor-help" title={pos.notes}>
                                                                            <FileText className="h-3 w-3" /> Note
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-400">
                                                            {pos.strike} {pos.type}
                                                            <div className="text-[10px] text-slate-600 mt-0.5">x{pos.quantity}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-500 text-xs">
                                                            {pos.entryTime}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-500">
                                                            ${pos.premium.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-slate-500">
                                                            ${pos.exitPrice?.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className={`flex flex-col items-end gap-0.5`}>
                                                                <div className={`flex items-center gap-1 font-bold ${isProfit ? "text-green-500" : "text-red-500"}`}>
                                                                    {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                    <span>${Math.abs(realizedPl).toFixed(2)}</span>
                                                                </div>
                                                                <div className={`text-xs ${isProfit ? "text-green-500/60" : "text-red-500/60"}`}>
                                                                    {isProfit ? "+" : ""}{returnPercent.toFixed(2)}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleOpenJournal(pos)}
                                                                    className="text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors h-8 w-8"
                                                                    title="Trade Journal"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => onDeleteHistory(pos.id)}
                                                                    className="text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors h-8 w-8"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Journal Modal */}
            <AnimatePresence>
                {editingTrade && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setEditingTrade(null)}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-[101] overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-500/10 rounded-xl">
                                        <FileText className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Trade Journal</h2>
                                </div>
                                <button onClick={() => setEditingTrade(null)} className="text-slate-500 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ticker / Strike</p>
                                        <p className="text-sm font-bold text-white uppercase">{editingTrade.symbol} {editingTrade.strike}{editingTrade.type}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Realized P&L</p>
                                        <p className={`text-sm font-black ${(editingTrade.realizedPl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            ${editingTrade.realizedPl?.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Strategy Post-Mortem & Observations</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="What was the setup? How did you feel? What could you improve?"
                                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-700"
                                    />
                                </div>

                                {reflection && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl"
                                    >
                                        <div className="flex items-center gap-2 mb-2 text-purple-400">
                                            <Brain className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Gemini Reflection</span>
                                        </div>
                                        <p className="text-xs text-slate-300 italic leading-relaxed">{reflection}</p>
                                    </motion.div>
                                )}

                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleSaveNotes}
                                        disabled={isSaving}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 h-10 rounded-xl font-bold uppercase text-[11px] tracking-widest"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save Journal</>}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={handleGetReflection}
                                        disabled={isReflecting || notes.length < 5}
                                        className="bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border border-purple-500/20 h-10 rounded-xl font-bold uppercase text-[11px] tracking-widest"
                                    >
                                        {isReflecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Brain className="mr-2 h-4 w-4" /> AI Reflect</>}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
