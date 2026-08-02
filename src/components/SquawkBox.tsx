"use client";

import React, { useState, useEffect } from "react";
import { fetchGoogleNews } from "@/app/actions";
import { format } from "date-fns";
import { ChevronRight, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

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

export function SquawkBox() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadNews = async () => {
            try {
                // Fetching breaking market news
                const data = await fetchGoogleNews("Stock Market Breaking News Options");
                setNews(data.slice(0, 15)); // Keep top 15 for the squawk box
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadNews();
        // Refresh every 5 minutes
        const interval = setInterval(loadNews, 300000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="border-emerald-500/20 bg-slate-900/60 shadow-[0_0_20px_rgba(16,185,129,0.05)] overflow-hidden flex flex-col h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-white/5 shrink-0 bg-slate-950/50 backdrop-blur-sm">
                <CardTitle className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wide">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Squawk Wire
                </CardTitle>
                <div className="text-xs font-mono text-emerald-500/70 py-1 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center">
                    <Activity className="w-3 h-3 inline mr-1 animate-pulse" />
                    LIVE
                </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto hide-scrollbar p-0 bg-slate-900/40">
                {loading ? (
                    <div className="h-full flex items-center justify-center space-x-2 text-emerald-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                ) : news.length > 0 ? (
                    <div className="divide-y divide-white/5">
                        {news.map((item, i) => (
                            <a
                                key={i}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col sm:flex-row gap-4 p-5 hover:bg-slate-800/60 transition-colors group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />

                                <div className="flex flex-col sm:w-24 shrink-0 text-slate-500 font-mono text-[10px] uppercase">
                                    <span className="text-emerald-400 group-hover:text-emerald-300 transition-colors font-bold tracking-wider">
                                        {format(item.datetime, "HH:mm:ss")}
                                    </span>
                                    <span className="mt-1 text-slate-500">{item.source}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors leading-tight mb-2">
                                        {item.headline}
                                    </h4>
                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-medium">
                                        {item.summary}
                                    </p>
                                </div>
                                <div className="hidden sm:flex items-center justify-center shrink-0 w-8">
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors translate-x-[-10px] group-hover:translate-x-0" />
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 font-medium text-sm">
                        No recent squawk news found.
                    </div>
                )}
            </div>
        </Card>
    );
}
