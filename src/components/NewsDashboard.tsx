"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, Globe, TrendingUp, Clock, ExternalLink, Newspaper, ArrowLeft } from "lucide-react";
import { fetchGoogleNews } from "@/app/actions";

interface NewsArticle {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related?: string;
    source: string;
    summary: string;
    url: string;
}

interface NewsDashboardProps {
    activeTickers?: string[];
}

export function NewsDashboard({ activeTickers = [] }: NewsDashboardProps) {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"market" | "company">("market");
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const loadMarketNews = async () => {
        setLoading(true);
        try {
            const data = await fetchGoogleNews("Stock Market Finance Options");
            setNews(data);
        } catch (error) {
            console.error("Failed to load market news", error);
        } finally {
            setLoading(false);
        }
    };

    const loadCompanyNews = async (ticker: string) => {
        setLoading(true);
        setSelectedTicker(ticker);
        setActiveTab("company");
        try {
            const data = await fetchGoogleNews(`${ticker} Stock Options Trading`);
            setNews(data);
        } catch (error) {
            console.error(`Failed to load news for ${ticker}`, error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "market") {
            loadMarketNews();
            setSelectedTicker(null);
        }
    }, [activeTab]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            loadCompanyNews(searchQuery.toUpperCase());
            setSearchQuery("");
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header / Config */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <Newspaper className="h-8 w-8 text-emerald-500" />
                        Global News Wire
                    </h2>
                    <p className="text-slate-400 font-medium mt-1">Real-time global feed via Google News</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <form onSubmit={handleSearch} className="relative group">
                        <input
                            type="text"
                            placeholder="Search Ticker (e.g. NVDA)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white px-4 py-2.5 pl-10 rounded-xl focus:outline-none focus:border-emerald-500 w-full sm:w-64 transition-all"
                        />
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                    </form>

                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={() => setActiveTab("market")}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === "market" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Market
                        </button>
                        <button
                            onClick={() => {
                                if (activeTickers.length > 0) loadCompanyNews(activeTickers[0]);
                                else setActiveTab("company");
                            }}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === "company" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Watchlist
                        </button>
                    </div>
                </div>
            </div>

            {/* Watchlist Quick Chips */}
            {activeTab === "company" && activeTickers.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    {activeTickers.map(ticker => (
                        <button
                            key={ticker}
                            onClick={() => loadCompanyNews(ticker)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedTicker === ticker ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600"}`}
                        >
                            {ticker}
                        </button>
                    ))}
                </div>
            )}

            {/* Content Content */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-64 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800/50" />
                        ))}
                    </div>
                ) : news.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Globe className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No news found</p>
                        <p className="text-sm opacity-60">Try searching for a different ticker or checking back later.</p>
                        {activeTab === "company" && !selectedTicker && (
                            <button onClick={() => setActiveTab("market")} className="mt-4 text-emerald-400 hover:underline text-sm">Return to Market News</button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {news.map((item) => (
                            <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300"
                            >
                                <div className="h-48 w-full bg-slate-950/50 relative overflow-hidden">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.headline}
                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-slate-900">
                                            <Newspaper className="h-12 w-12 text-slate-800" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/5">
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{item.source}</p>
                                    </div>
                                </div>
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="h-3 w-3 text-emerald-500" />
                                        <span className="text-xs text-slate-500 font-medium">
                                            {format(new Date(item.datetime * 1000), "MMM d, h:mm a")}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-200 leading-tight mb-3 group-hover:text-emerald-400 transition-colors line-clamp-3">
                                        {item.headline}
                                    </h3>
                                    <p className="text-sm text-slate-400 line-clamp-3 mb-4 flex-1">
                                        {item.summary}
                                    </p>
                                    <div className="flex items-center text-emerald-500 text-xs font-bold uppercase tracking-widest mt-auto">
                                        Read Story <ExternalLink className="ml-1 h-3 w-3" />
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
