"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { fetchBreakingNews } from "@/app/actions";

interface BreakingArticle {
    id: string;
    headline: string;
    source: string;
    url: string;
    timestamp: number;
}

export function BreakingNewsAlert() {
    const [article, setArticle] = useState<BreakingArticle | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkNews = async () => {
            try {
                const latestNews = await fetchBreakingNews();

                // If we get an article and it's component is still mounted
                if (latestNews && isMounted) {
                    const lastSeenId = localStorage.getItem("last_seen_breaking_news_id");

                    // Only show if it's a completely new headline ID
                    if (latestNews.id !== lastSeenId) {
                        setArticle(latestNews);
                        setIsVisible(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check breaking news:", error);
            }
        };

        // Check immediately on mount
        checkNews();

        // Then check every 60 seconds
        const interval = setInterval(checkNews, 60000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const dismissAlert = () => {
        if (article) {
            localStorage.setItem("last_seen_breaking_news_id", article.id);
            setIsVisible(false);
        }
    };

    if (!isVisible || !article) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-4 shadow-2xl shadow-red-900/20 backdrop-blur-xl relative overflow-hidden group">

                {/* Background animated pulse */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/20 transition-all duration-700" />

                <div className="flex items-start justify-between mb-2 relative z-10">
                    <div className="flex items-center gap-2 text-red-500 font-bold tracking-widest text-xs uppercase">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        Breaking News • {article.source}
                    </div>
                    <button
                        onClick={dismissAlert}
                        className="text-slate-500 hover:text-white transition-colors p-1"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <h3 className="text-white font-bold text-base leading-snug mb-4 relative z-10">
                    {article.headline}
                </h3>

                <div className="flex justify-start relative z-10">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={dismissAlert} // If they click read more, consider it 'seen'
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-red-500/20 transition-all"
                    >
                        Read Story <ArrowRight className="h-3 w-3" />
                    </a>
                </div>
            </div>
        </div>
    );
}
