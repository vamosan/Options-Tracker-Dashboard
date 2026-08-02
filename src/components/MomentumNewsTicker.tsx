"use client";

import React, { useEffect, useState } from "react";
import { fetchBreakingNews } from "@/app/actions";
import { Newspaper } from "lucide-react";
import { motion } from "framer-motion";

export function MomentumNewsTicker() {
    const [news, setNews] = useState<any[]>([]);

    useEffect(() => {
        let active = true;
        async function loadNews() {
            try {
                const data = await fetchBreakingNews();
                if (active && data) {
                    setNews([data]);
                }
            } catch (error) {
                console.error("Failed to fetch breaking news", error);
            }
        }
        
        loadNews();
        // Refresh every 60 seconds
        const interval = setInterval(loadNews, 60000);
        
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    if (news.length === 0) return null;

    // Duplicate array to create a seamless infinite scrolling marquee effect
    const displayNews = [...news, ...news, ...news, ...news, ...news];

    return (
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl backdrop-blur-md h-12 overflow-hidden flex items-center relative z-20 mb-8 shadow-xl">
            {/* Fixed Left Header */}
            <div className="absolute left-0 top-0 bottom-0 px-4 bg-slate-900 border-r border-slate-800 z-20 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-cyan-400 shadow-[10px_0_20px_rgba(0,0,0,0.8)]">
                <Newspaper className="h-4 w-4" /> Market Wire
            </div>
            
            {/* Fade edge on the right */}
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

            <motion.div
                className="flex items-center gap-12 whitespace-nowrap pl-40" // pl-40 to offset the fixed left header
                animate={{ x: [0, -3000] }} // Adjust depending on average content width
                transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration: 60, // Slower duration for readability
                }}
            >
                {displayNews.map((n, i) => (
                    <div key={`${n.id || i}-${i}`} className="flex items-center gap-3">
                        <span className="text-[9px] font-bold bg-slate-800/80 text-cyan-500/80 px-2 py-0.5 rounded border border-cyan-500/20 uppercase tracking-wider">
                            {n.source || "News"}
                        </span>
                        <a href={n.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer">
                            {n.headline}
                        </a>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-700 ml-8" />
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
