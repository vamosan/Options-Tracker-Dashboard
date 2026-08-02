"use client";

import React, { useEffect, useState } from "react";
import { Position } from "@/lib/types";
import {
    analyzeTrade, fetchStockPrice, chatWithGemini, fetchSmartMoneyFlow,
    chatWithGeminiGeneral, fetchBatchStockPrices, getGeminiTradeReview,
    fetchUpcomingEarnings, fetchEconomicCalendar
} from "@/app/actions";
import {
    Brain, X, Activity, TrendingUp, Clock, Target,
    Loader2, Zap, ShieldCheck, BarChart2, LayoutDashboard,
    MessageSquarePlus, Sparkles, Send, Search, Plus, Trash2, Flame, MessageCircle
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface TickerPrice {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
}

interface IntelligenceSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTickers: string[];
    selectedPosition?: Position | null;
}

export function IntelligenceSidebar({ isOpen, onClose, activeTickers, selectedPosition }: IntelligenceSidebarProps) {
    const [activeTab, setActiveTab] = useState<"market" | "ai" | "flow">("market");
    const [prices, setPrices] = useState<Record<string, TickerPrice>>({});
    const [marketLoading, setMarketLoading] = useState(false);

    const [analysis, setAnalysis] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // Gemini Specific States
    const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
    const [isGeminiLoading, setIsGeminiLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Watchlist States
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddingTicker, setIsAddingTicker] = useState(false);

    // Catalyst States
    const [ecoCalendar, setEcoCalendar] = useState<any[]>([]);
    const [earningsData, setEarningsData] = useState<Record<string, any>>({});
    const [isCatalystLoading, setIsCatalystLoading] = useState(false);

    // Smart Flow State
    const [flowData, setFlowData] = useState<any[]>([]);
    const [isFlowLoading, setIsFlowLoading] = useState(false);

    // Load watchlist on mount
    useEffect(() => {
        const saved = localStorage.getItem("options-tracker-watchlist");
        if (saved) {
            try {
                setWatchlist(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse watchlist", e);
            }
        }
    }, []);

    // Save watchlist on change
    useEffect(() => {
        localStorage.setItem("options-tracker-watchlist", JSON.stringify(watchlist));
    }, [watchlist]);

    const addToWatchlist = async (e: React.FormEvent) => {
        e.preventDefault();
        const symbol = searchQuery.toUpperCase().trim();
        if (!symbol || watchlist.includes(symbol) || activeTickers.includes(symbol)) {
            setSearchQuery("");
            return;
        }

        setIsAddingTicker(true);
        try {
            const data = await fetchStockPrice(symbol);
            if (data && data.price > 0) {
                setWatchlist(prev => [...prev, symbol]);
                setSearchQuery("");
            } else {
                alert(`Could not find ticker: ${symbol}`);
            }
        } catch (error) {
            console.error("Failed to add ticker", error);
        } finally {
            setIsAddingTicker(false);
        }
    };

    const removeFromWatchlist = (symbol: string) => {
        setWatchlist(prev => prev.filter(s => s !== symbol));
    };

    const handleGeminiReview = async () => {
        if (!selectedPosition) return;
        setIsGeminiLoading(true);
        try {
            const result = await getGeminiTradeReview(selectedPosition);
            setGeminiAnalysis(result);
            setChatHistory([
                { role: 'model', parts: [{ text: result.advice }] }
            ]);
        } catch (error) {
            console.error("Gemini Review failed:", error);
        } finally {
            setIsGeminiLoading(false);
        }
    };

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading || !selectedPosition) return;

        const userMsg = chatInput;
        setChatInput("");
        const newHistory = [...chatHistory, { role: 'user' as const, parts: [{ text: userMsg }] }];
        setChatHistory(newHistory);
        setIsChatLoading(true);

        try {
            const response = await chatWithGemini(selectedPosition, chatHistory, userMsg);
            if (response.includes("trouble processing")) {
                setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: "❌ Gemini API Error: " + response }] }]);
            } else {
                setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: response }] }]);
            }
        } catch (error: any) {
            console.error("Chat failed:", error);
            setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: "⚠️ Connectivity Error: " + (error.message || "Unable to reach AI services.") }] }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const [flows, setFlows] = useState<any[]>([]);
    // Switch to AI tab if a position is selected
    useEffect(() => {
        if (selectedPosition) {
            setActiveTab("ai");
            setGeminiAnalysis(null);
            setChatHistory([]);
        }
    }, [selectedPosition]);

    // Market Pulse Update Logic
    const updateMarket = async () => {
        const allTickers = Array.from(new Set([...activeTickers, ...watchlist]));
        if (allTickers.length === 0) return;

        setMarketLoading(true);
        try {
            const batchPrices = await fetchBatchStockPrices(allTickers);
            const newPrices: Record<string, TickerPrice> = {};

            Object.entries(batchPrices).forEach(([symbol, data]) => {
                newPrices[symbol] = { symbol, ...data };
            });

            setPrices(newPrices);
        } catch (error) {
            console.error("Failed to update market pulse:", error);
        } finally {
            setMarketLoading(false);
        }
    };

    const updateCatalysts = async () => {
        setIsCatalystLoading(true);
        const allTickers = Array.from(new Set([...activeTickers, ...watchlist]));
        try {
            const [eco, ...earnResults] = await Promise.all([
                fetchEconomicCalendar(),
                ...allTickers.map(s => fetchUpcomingEarnings(s))
            ]);

            setEcoCalendar(eco);
            const earnMap: Record<string, any> = {};
            allTickers.forEach((s, i) => {
                if (earnResults[i]) earnMap[s] = earnResults[i];
            });
            setEarningsData(earnMap);
        } catch (error) {
            console.error("Failed to fetch catalysts", error);
        } finally {
            setIsCatalystLoading(false);
        }
    };

    // AI Analysis Update Logic
    const updateAI = async () => {
        if (!selectedPosition) return;
        setAiLoading(true);
        const res = await analyzeTrade(selectedPosition);
        setAnalysis(res);
        setAiLoading(false);
    };

    // Stabilize the dependency list to prevent unnecessary effect triggers
    const tickerKey = JSON.stringify([...activeTickers, ...watchlist].sort());

    const updateFlow = async () => {
        setIsFlowLoading(true);
        try {
            const data = await fetchSmartMoneyFlow();
            setFlowData(data);
        } catch (error) {
            console.error("Failed to fetch smart flow", error);
        } finally {
            setIsFlowLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (activeTab === "market") {
                updateMarket();
                updateCatalysts();
                const interval = setInterval(updateMarket, 30000);
                return () => clearInterval(interval);
            } else if (activeTab === "flow") {
                updateFlow();
                const interval = setInterval(updateFlow, 60000); // 1 min for flow
                return () => clearInterval(interval);
            }
        }
    }, [isOpen, activeTab, tickerKey]);

    useEffect(() => {
        if (isOpen && activeTab === "ai" && selectedPosition) {
            updateAI();
        }
    }, [isOpen, activeTab, selectedPosition]);

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-slate-900 border-l border-slate-800 z-50 shadow-2xl flex flex-col transition-all duration-500 ease-in-out">
                {/* Visual Header Decoration */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

                {/* Top Nav */}
                <div className="flex items-center justify-between px-6 pt-8 pb-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => setActiveTab("market")}
                            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === "market" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                        >
                            <Activity className="h-4 w-4 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Market</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("ai")}
                            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === "ai" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                        >
                            <Brain className="h-4 w-4 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center leading-none">Gemini</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("flow")}
                            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === "flow" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                        >
                            <Zap className="h-4 w-4 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center leading-none">Smart Flow</span>
                        </button>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        {activeTab === "market" && (
                            <div className="space-y-6 animate-in slide-in-from-left duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <LayoutDashboard className="h-4 w-4 text-cyan-500" />
                                        Market Watch
                                    </h3>
                                    {marketLoading && <Loader2 className="h-4 w-4 text-cyan-500 animate-spin" />}
                                </div>

                                {/* Search Bar */}
                                <form onSubmit={addToWatchlist} className="flex gap-2 p-1.5 bg-slate-950/60 rounded-xl border border-white/5">
                                    <div className="flex-1 flex items-center gap-2 px-3">
                                        <Search className="h-3.5 w-3.5 text-slate-500" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Add to Watchlist (e.g. BTC-USD, AAPL)"
                                            className="bg-transparent border-none text-xs text-white placeholder:text-slate-600 focus:outline-none w-full"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isAddingTicker || !searchQuery.trim()}
                                        className="h-8 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                                    >
                                        {isAddingTicker ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    </Button>
                                </form>

                                {activeTickers.length === 0 && watchlist.length === 0 ? (
                                    <div className="py-20 text-center opacity-40">
                                        <BarChart2 className="h-12 w-12 mx-auto mb-4" />
                                        <p className="text-sm font-mono tracking-tighter uppercase italic">No Active Tickers</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {/* Combine and sort: Active trades first, then watchlist */}
                                        {[...activeTickers, ...watchlist].map(symbol => {
                                            const data = prices[symbol];
                                            const isActive = activeTickers.includes(symbol);
                                            const earnings = earningsData[symbol];
                                            return (
                                                <div key={symbol} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
                                                    {isActive && (
                                                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/10 border-b border-l border-cyan-500/20 rounded-bl-lg">
                                                            <span className="text-[8px] font-black text-cyan-500 uppercase tracking-tighter">Active Trade</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div>
                                                                <p className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{symbol}</p>
                                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                                    {isActive ? "Portfolio Asset" : "Watchlist Ticker"}
                                                                    {earnings && (
                                                                        <span className="text-[8px] text-yellow-500/80 border border-yellow-500/20 px-1 rounded bg-yellow-500/5">
                                                                            Earnings: {format(new Date(earnings.date), "MMM d")}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {!isActive && (
                                                                <button
                                                                    onClick={() => removeFromWatchlist(symbol)}
                                                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-slate-600 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {data && (
                                                            <div className={`text-right ${data.change >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                                                <p className="text-xl font-mono font-bold tracking-tighter">
                                                                    {data.price > 0 ? `$${data.price.toFixed(2)}` : "Syncing..."}
                                                                </p>
                                                                {data.price > 0 && (
                                                                    <div className="flex items-center justify-end text-[10px] font-black">
                                                                        {data.change >= 0 ? "+" : ""}{data.changePercent.toFixed(2)}%
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Economic Calendar Section */}
                                <div className="mt-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-purple-500" />
                                            Macro Calendar
                                        </h3>
                                        {isCatalystLoading && <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />}
                                    </div>

                                    <div className="space-y-2">
                                        {ecoCalendar.length === 0 && !isCatalystLoading ? (
                                            <p className="text-[10px] text-slate-600 font-mono italic text-center py-4 uppercase">No major data releases today</p>
                                        ) : (
                                            ecoCalendar.map((event, idx) => (
                                                <div key={idx} className="p-3 bg-slate-950/20 border border-white/5 rounded-xl flex items-center justify-between group hover:bg-white/5 transition-all">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] text-white font-bold truncate tracking-tight">{event.event}</p>
                                                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                                                            {event.country} • {format(new Date(event.time), "HH:mm")}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        {event.importance >= 3 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-black uppercase border border-red-500/20">High</span>
                                                        )}
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-mono font-bold text-slate-300">{event.actual || event.prev}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "ai" && (
                            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                {!selectedPosition ? (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="h-16 w-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto border border-purple-500/20">
                                            <ShieldCheck className="h-8 w-8 text-purple-400 opacity-50" />
                                        </div>
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Select a trade for AI Review</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {aiLoading ? (
                                            <div className="py-12 flex flex-col items-center justify-center space-y-6">
                                                <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                                                <p className="text-slate-400 font-mono text-[10px] uppercase tracking-tighter animate-pulse">Syncing Heuristics...</p>
                                            </div>
                                        ) : analysis && (
                                            <div className="space-y-6">
                                                {/* Contract Summary */}
                                                <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Contract Scan</p>
                                                        <h4 className="text-white font-black text-sm uppercase tracking-tight">
                                                            {selectedPosition.symbol} ${selectedPosition.strike} {selectedPosition.type}
                                                        </h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                                                        <p className="text-cyan-400 font-mono font-black">{analysis.confidence}%</p>
                                                    </div>
                                                </div>

                                                {/* Hero Action */}
                                                <div className={`p-6 rounded-3xl border shadow-xl flex items-center justify-between ${analysis.statusColor === 'green' ? 'bg-green-500/10 border-green-500/20' :
                                                    analysis.statusColor === 'red' ? 'bg-red-500/10 border-red-500/20' :
                                                        'bg-cyan-500/10 border-cyan-500/20'
                                                    }`}>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Verdict</p>
                                                        <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${analysis.statusColor === 'green' ? 'text-green-400' :
                                                            analysis.statusColor === 'red' ? 'text-red-400' :
                                                                'text-cyan-400'
                                                            }`}>
                                                            {analysis.recommendation}
                                                        </h3>
                                                    </div>
                                                    <div className="bg-black/40 p-2 rounded-xl">
                                                        <Zap className="h-5 w-5 text-yellow-500" />
                                                    </div>
                                                </div>

                                                {/* Gemini Discussion Box */}
                                                <div className="bg-slate-950/40 rounded-3xl border border-white/5 overflow-hidden flex flex-col min-h-[400px]">
                                                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="h-4 w-4 text-cyan-400" />
                                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Gemini Discuss</span>
                                                        </div>
                                                        {chatHistory.length > 0 && (
                                                            <button
                                                                onClick={() => setChatHistory([])}
                                                                className="text-[9px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                                                            >
                                                                Reset
                                                            </button>
                                                        )}
                                                    </div>

                                                    <ScrollArea className="flex-1 p-4 h-[350px]">
                                                        {chatHistory.length === 0 ? (
                                                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                                                {!geminiAnalysis && !isGeminiLoading ? (
                                                                    <Button
                                                                        onClick={handleGeminiReview}
                                                                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl px-6"
                                                                    >
                                                                        Start Gemini Deep Review
                                                                    </Button>
                                                                ) : isGeminiLoading ? (
                                                                    <div className="flex flex-col items-center space-y-4">
                                                                        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
                                                                        <p className="text-[9px] text-slate-500 font-black uppercase animate-pulse">Consulting Gemini...</p>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {chatHistory.map((msg, idx) => (
                                                                    <motion.div
                                                                        key={idx}
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                                    >
                                                                        <div className={`max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user'
                                                                            ? 'bg-blue-600 text-white rounded-tr-none shadow-lg'
                                                                            : 'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-none'
                                                                            }`}>
                                                                            {msg.parts[0].text}
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                                {isChatLoading && (
                                                                    <div className="flex justify-start">
                                                                        <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
                                                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </ScrollArea>

                                                    <div className="p-4 bg-slate-900/50 border-t border-white/5">
                                                        <form onSubmit={handleChat} className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={chatInput}
                                                                onChange={(e) => setChatInput(e.target.value)}
                                                                placeholder={geminiAnalysis ? "Ask anything about this trade..." : "Perform Review First"}
                                                                disabled={!geminiAnalysis || isChatLoading}
                                                                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none transition-colors"
                                                            />
                                                            <Button
                                                                type="submit"
                                                                disabled={!geminiAnalysis || isChatLoading || !chatInput.trim()}
                                                                className="h-10 w-10 p-0 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
                                                            >
                                                                <Send size={16} />
                                                            </Button>
                                                        </form>
                                                    </div>
                                                </div>

                                                {/* Risk Stats Summary */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-4 rounded-2xl bg-slate-800/20 border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Theta Burn</p>
                                                        <p className={`text-lg font-black font-mono ${analysis.stats.timeValueRisk === 'High' ? 'text-red-400' : 'text-green-400'}`}>
                                                            {analysis.stats.timeValueRisk}
                                                        </p>
                                                    </div>
                                                    <div className={`p-4 rounded-2xl border ${geminiAnalysis?.sentiment === 'Bullish' ? 'bg-green-500/5 border-green-500/10' :
                                                        geminiAnalysis?.sentiment === 'Bearish' ? 'bg-red-500/5 border-red-500/10' :
                                                            'bg-slate-800/20 border-white/5'
                                                        }`}>
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Gemini Sentiment</p>
                                                        <p className="text-lg font-black font-mono text-white">
                                                            {geminiAnalysis?.sentiment || 'Neutral'}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-slate-800/20 border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Prob. of Profit (POP)</p>
                                                        <p className={`text-lg font-black font-mono ${analysis.stats.pop > 65 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                            {analysis.stats.pop}%
                                                        </p>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-slate-800/20 border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Implied Vol (IV)</p>
                                                        <p className="text-lg font-black font-mono text-cyan-400">
                                                            {(analysis.greeks.iv * 100).toFixed(1)}%
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "flow" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-500" />
                                        Real-Time Smart Money Flow
                                    </h3>
                                    {isFlowLoading && <Loader2 className="h-3 w-3 text-cyan-500 animate-spin" />}
                                </div>

                                {flowData.length === 0 && !isFlowLoading ? (
                                    <div className="py-20 text-center opacity-40">
                                        <Activity className="h-12 w-12 mx-auto mb-4" />
                                        <p className="text-sm font-mono tracking-tighter uppercase italic">No Unusual Activity Detected</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {flowData.map((flow, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-sm font-black text-white group-hover:text-cyan-400 transition-colors">{flow.symbol}</span>
                                                        <p className="text-[10px] text-slate-500 font-bold font-mono">{flow.contract}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${flow.sentiment === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {flow.sentiment}
                                                        </span>
                                                        <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">Conviction: {flow.score}%</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <div className="flex gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-600 text-[8px] font-black uppercase">Volume</span>
                                                            <span className="text-white font-mono font-bold">{(flow.volume / 100).toFixed(1)}k</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-600 text-[8px] font-black uppercase">Est. Prem</span>
                                                            <span className="text-white font-mono font-bold">${flow.price.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {flow.socialScore && (
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-white/5" title={`Social Hype Score: ${flow.socialScore}`}>
                                                                <Flame className={`h-3 w-3 ${flow.socialTrend === 'Viral' ? 'text-orange-500 animate-pulse' : flow.socialTrend === 'Trending' ? 'text-yellow-500' : 'text-slate-500'}`} />
                                                                <span className="text-[9px] font-bold text-slate-300 font-mono">{flow.socialScore}</span>
                                                            </div>
                                                        )}
                                                        <span className="text-[9px] text-slate-700 font-mono italic">{flow.timestamp}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-center">
                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.3em]">
                        OptionsTracker Intelligence • V2.0
                    </p>
                </div>
            </div>

            <button
                onClick={onClose}
                className="fixed top-4 right-4 z-[60] p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all bg-slate-900 border border-slate-800 shadow-xl"
            >
                <X className="h-5 w-5" />
            </button>
        </>
    );
}
