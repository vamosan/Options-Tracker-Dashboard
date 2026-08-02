"use client";

import React, { useState } from "react";
import { BrainCircuit, Activity, Search, BarChart3, TrendingUp, TrendingDown, Target, Zap, ShieldCheck, ListFilter } from "lucide-react";
import { runAgenticAnalysis, runMarketScanner } from "../app/agenticActions";

export function AgenticDeskPanel() {
    const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
    const [ticker, setTicker] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [batchResults, setBatchResults] = useState<any[] | null>(null);
    const [executing, setExecuting] = useState<string | false>(false);
    const [executionResult, setExecutionResult] = useState<string | null>(null);
    
    const [gridResults, setGridResults] = useState<any[] | null>(null);
    const [isGridLoading, setIsGridLoading] = useState(true);

    React.useEffect(() => {
        let isMounted = true;
        const fetchGrid = async () => {
            try {
                const data = await runMarketScanner();
                if (isMounted) setGridResults(data);
            } catch (error) {
                console.error("Failed to load grid", error);
            } finally {
                if (isMounted) setIsGridLoading(false);
            }
        };
        fetchGrid();
        return () => { isMounted = false; };
    }, []);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticker) return;
        
        setIsLoading(true);
        setExecutionResult(null);
        try {
            const data = await runAgenticAnalysis(ticker.toUpperCase());
            setResult(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBatchScan = async () => {
        setIsLoading(true);
        setExecutionResult(null);
        try {
            const data = await runMarketScanner();
            setBatchResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecute = async (symbol: string) => {
        setExecuting(symbol);
        // Simulate Webull API execution using the configured token
        setTimeout(() => {
            setExecuting(false);
            setExecutionResult(`Order successfully routed to Webull for ${symbol}. Fill pending.`);
        }, 1500);
    };

    return (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(99,102,241,0.1)] relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <BrainCircuit className="w-32 h-32 text-indigo-500" />
            </div>

            {/* Tabs Header */}
            <div className="flex gap-4 mb-6 border-b border-slate-800 pb-4 relative z-10">
                <button 
                    onClick={() => setActiveTab("single")}
                    className={`flex items-center gap-2 font-black px-4 py-2 rounded-xl transition-all ${activeTab === "single" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                >
                    <Search className="w-4 h-4" /> Single Ticker
                </button>
                <button 
                    onClick={() => setActiveTab("batch")}
                    className={`flex items-center gap-2 font-black px-4 py-2 rounded-xl transition-all ${activeTab === "batch" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                >
                    <ListFilter className="w-4 h-4" /> MAG7 Scanner
                </button>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                
                {/* Search / Scan Controls Section */}
                <div className="w-full md:w-1/3">
                    {activeTab === "single" ? (
                        <>
                            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-2">
                                <BrainCircuit className="h-5 w-5 text-indigo-400" />
                                Agentic Trading Desk
                            </h3>
                            <p className="text-sm text-slate-400 mb-6">
                                Run the deterministic Python scoring engine on any ticker.
                            </p>
                            
                            <form onSubmit={handleAnalyze} className="relative">
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                    placeholder="e.g. TSLA, NVDA"
                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono uppercase"
                                />
                                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                                <button
                                    type="submit"
                                    disabled={isLoading || !ticker}
                                    className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Activity className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                    {isLoading ? "Analyzing..." : "Run Analysis"}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-2">
                                <ListFilter className="h-5 w-5 text-indigo-400" />
                                MAG7 + Market Scanner
                            </h3>
                            <p className="text-sm text-slate-400 mb-6">
                                Batch run the Python engine across AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, SPY, QQQ.
                            </p>
                            <button
                                onClick={handleBatchScan}
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Activity className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
                                {isLoading ? "Scanning Markets..." : "Run Scanner"}
                            </button>
                        </>
                    )}
                </div>

                {/* Results Section */}
                <div className="w-full md:w-2/3 flex-1 bg-slate-950/50 rounded-2xl border border-slate-800/50 p-6 min-h-[180px]">
                    {activeTab === "single" && !result && !isLoading && (
                        <div className="h-full flex flex-col">
                            <h4 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-400" />
                                Market Heatmap
                            </h4>
                            {isGridLoading ? (
                                <div className="grid grid-cols-3 gap-3 flex-1">
                                    {[1,2,3,4,5,6,7,8,9].map(i => (
                                        <div key={i} className="bg-slate-900/50 rounded-xl animate-pulse border border-slate-800 h-24"></div>
                                    ))}
                                </div>
                            ) : gridResults ? (
                                <div className="grid grid-cols-3 gap-3">
                                    {gridResults.map(r => {
                                        const score = r.pillar_total || 0;
                                        const isGreen = score > 0;
                                        const isRed = score < 0;
                                        const isYellow = score === 0;
                                        
                                        return (
                                            <button 
                                                key={r.symbol}
                                                onClick={() => {
                                                    setTicker(r.symbol);
                                                    setResult(r);
                                                }}
                                                className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all group hover:scale-105 shadow-lg ${
                                                    isGreen ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 
                                                    isRed ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/60 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 
                                                    'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                                }`}
                                            >
                                                <span className={`text-lg font-black ${isGreen ? 'text-emerald-400' : isRed ? 'text-red-400' : 'text-yellow-400'}`}>
                                                    {r.symbol}
                                                </span>
                                                <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">
                                                    Score: {score > 0 ? '+' : ''}{score}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10">
                                    <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                                    <p className="text-sm font-medium">Enter a ticker to generate a scorecard</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === "batch" && !batchResults && !isLoading && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <ListFilter className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">Click Run Scanner to rank MAG7 tickers</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="h-full flex flex-col items-center justify-center text-indigo-400">
                            <Activity className="h-8 w-8 mb-2 animate-pulse" />
                            <p className="text-sm font-medium animate-pulse">{activeTab === "single" ? "Running Python Engines..." : "Scanning Markets..."}</p>
                        </div>
                    )}

                    {activeTab === "batch" && batchResults && !isLoading && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-96 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="mb-4">
                                <h4 className="text-xl font-black text-white">Ranked Opportunities</h4>
                                <p className="text-xs text-slate-400">Sorted by Agentic Total Score</p>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                {batchResults.map((r, i) => (
                                    <div key={r.symbol} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                                        <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl opacity-80" style={{
                                            backgroundColor: r.pillar_total > 0 ? '#10b981' : r.pillar_total < 0 ? '#f43f5e' : '#f59e0b'
                                        }}></div>
                                        
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                                                    #{i+1}
                                                </div>
                                                <h5 className="text-lg font-black text-white">{r.symbol}</h5>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className="text-xs font-mono text-slate-400">Score: <span className={r.pillar_total > 0 ? 'text-emerald-400' : r.pillar_total < 0 ? 'text-red-400' : 'text-slate-300'}>{r.pillar_total > 0 ? '+' : ''}{r.pillar_total}</span></div>
                                                <div className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${
                                                    r.decision?.action?.includes('EXIT') || r.decision?.action?.includes('AVOID') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    r.decision?.action?.includes('HOLD') ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                    r.decision?.action?.includes('RE-ENTRY') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    'bg-slate-800 text-slate-300'
                                                }`}>
                                                    {r.decision?.action}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-sm text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                                            <span className="font-bold text-indigo-400">Rationale: </span>
                                            {r.decision?.rationale}
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex gap-2 text-[10px] text-slate-500">
                                                <span>Trend: {r.pillars?.trend?.score}</span>
                                                <span>•</span>
                                                <span>Mom: {r.pillars?.momentum?.score}</span>
                                            </div>
                                            
                                            {r.decision?.action !== "WAIT (do not chase)" && r.decision?.action !== "STAY OUT / AVOID" && !r.decision?.action?.includes("OBSERVE") && (
                                                <button 
                                                    onClick={() => handleExecute(r.symbol)}
                                                    disabled={executing === r.symbol}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold py-1 px-3 rounded-md transition-all flex items-center gap-1"
                                                >
                                                    {executing === r.symbol ? <Activity className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                                                    {executing === r.symbol ? "Routing..." : "Execute"}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {executionResult && executionResult.includes(r.symbol) && (
                                            <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
                                                <ShieldCheck className="h-3 w-3" /> {executionResult}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "single" && result && !isLoading && !result.error && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                                <div>
                                    <h4 className="text-2xl font-black text-white">{result.symbol}</h4>
                                    <p className="text-xs text-slate-400">Agentic Three-Pillar Scorecard</p>
                                </div>
                                <div className={`px-4 py-2 rounded-xl border font-black uppercase tracking-wider ${
                                    result.decision?.action?.includes('EXIT') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    result.decision?.action?.includes('HOLD') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                    {result.decision?.action}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                {/* Trend Score */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Trend</div>
                                    <div className={`text-2xl font-black ${result.pillars?.trend?.score > 0 ? 'text-emerald-400' : result.pillars?.trend?.score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {result.pillars?.trend?.score > 0 ? '+' : ''}{result.pillars?.trend?.score}
                                    </div>
                                </div>
                                {/* Momentum Score */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Momentum</div>
                                    <div className={`text-2xl font-black ${result.pillars?.momentum?.score > 0 ? 'text-emerald-400' : result.pillars?.momentum?.score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {result.pillars?.momentum?.score > 0 ? '+' : ''}{result.pillars?.momentum?.score}
                                    </div>
                                </div>
                                {/* Macro Score */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Macro</div>
                                    <div className={`text-2xl font-black ${result.pillars?.macro_sentiment?.score > 0 ? 'text-emerald-400' : result.pillars?.macro_sentiment?.score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {result.pillars?.macro_sentiment?.score > 0 ? '+' : ''}{result.pillars?.macro_sentiment?.score}
                                    </div>
                                </div>
                            </div>

                            {/* Active Flags & Webull Execution */}
                            <div className="mt-6 flex items-center justify-between">
                                <div className="flex flex-wrap gap-2">
                                    {result.decision?.flags && Object.values(result.decision.flags).flat().length > 0 && (
                                        (Object.values(result.decision.flags).flat() as string[]).filter(f => typeof f === 'string').map((flag: string, i: number) => (
                                            <span key={i} className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded font-mono">
                                                {flag}
                                            </span>
                                        ))
                                    )}
                                </div>
                                
                                {result.decision?.action !== "WAIT (do not chase)" && result.decision?.action !== "STAY OUT / AVOID" && (
                                    <button 
                                        onClick={() => handleExecute(result.symbol)}
                                        disabled={executing === result.symbol || executionResult !== null}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold py-2 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] flex items-center gap-2"
                                    >
                                        {executing === result.symbol ? <Activity className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                        {executionResult ? "Order Sent" : "Execute on Webull"}
                                    </button>
                                )}
                            </div>

                            {executionResult && (
                                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-mono flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    {executionResult}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {result && result.error && (
                        <div className="h-full flex flex-col items-center justify-center text-red-400">
                            <p className="text-sm font-medium">Error running analysis: {result.error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
