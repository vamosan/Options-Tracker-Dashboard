import React, { useEffect, useState } from "react";
import { getTopVolumeTickers } from "@/app/actions";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function LiveTicker() {
    const [tickers, setTickers] = useState<any[]>([]);

    useEffect(() => {
        let active = true;

        async function fetchTickers() {
            const data = await getTopVolumeTickers();
            if (active && data) {
                setTickers(data);
            }
        }

        fetchTickers();
        // Refresh every 15 seconds to simulate live data
        const interval = setInterval(fetchTickers, 15000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    if (tickers.length === 0) {
        return (
            <div className="w-full bg-slate-900/50 border-y border-slate-800/50 h-10 flex items-center justify-center">
                <Activity className="h-4 w-4 animate-pulse text-cyan-500/50" />
            </div>
        );
    }

    // Double the array for seamless marquee loop
    const displayTickers = [...tickers, ...tickers, ...tickers, ...tickers];

    return (
        <div className="w-full bg-slate-950/80 border-y border-slate-800 backdrop-blur-md h-10 overflow-hidden flex items-center relative z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)]">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

            <motion.div
                className="flex items-center gap-8 whitespace-nowrap pl-4"
                animate={{ x: [0, -1035] }} // Adjust width based on total content size to loop smoothly
                transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration: 30, // Adjust speed
                }}
            >
                {displayTickers.map((ticker, i) => (
                    <div key={`${ticker.symbol}-${i}`} className="flex items-center gap-2 group">
                        <span className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">
                            {ticker.symbol}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                            ${ticker.price?.toFixed(2)}
                        </span>
                        <span
                            className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${ticker.changePercent >= 0
                                    ? "text-emerald-400 bg-emerald-500/10"
                                    : "text-red-400 bg-red-500/10"
                                }`}
                        >
                            {ticker.changePercent >= 0 ? (
                                <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                            ) : (
                                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                            )}
                            {Math.abs(ticker.changePercent || 0).toFixed(2)}%
                        </span>
                        {/* Dot separator */}
                        <div className="h-1 w-1 rounded-full bg-slate-800 ml-4" />
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
