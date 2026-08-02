"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, X, ArrowRight, Bell, Volume2, ShieldCheck } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface TradeAlert {
    symbol: string;
    contractSymbol: string;
    type: "Call" | "Put";
    strike: number;
    expiration: string;
    marketPrice: number;
    theoreticalPrice: number;
    iv: number;
    hv: number;
    edgePercent: number;
    action: "BUY" | "SELL";
    volume: number;
    openInterest: number;
    timestamp: string;
    isSimulated?: boolean;
}

export function ProfitableTradeAlert() {
    const [alert, setAlert] = useState<TradeAlert | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
    const socketRef = useRef<Socket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Synchronize permission setting on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            if ("Notification" in window) {
                setNotificationPermission(Notification.permission);
            } else {
                setNotificationPermission("unsupported");
            }
        }
    }, []);

    // Connect to Web Socket
    useEffect(() => {
        const socket = io(window.location.origin);
        socketRef.current = socket;

        socket.on("profitable_trade_alert", (newAlert: TradeAlert) => {
            triggerAlert(newAlert);
        });

        return () => {
            socket.disconnect();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Synth double chime audio chime generator using Web Audio API
    const playChimeSound = () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const audioCtx = new AudioContextClass();
            
            // Ding 1 (C5)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.3);

            // Ding 2 (E5) after 100ms
            setTimeout(() => {
                try {
                    const osc2 = audioCtx.createOscillator();
                    const gain2 = audioCtx.createGain();
                    osc2.type = "sine";
                    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
                    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
                    
                    osc2.connect(gain2);
                    gain2.connect(audioCtx.destination);
                    osc2.start();
                    osc2.stop(audioCtx.currentTime + 0.4);
                } catch (e) {}
            }, 100);
        } catch (e) {
            console.warn("Audio Context blocked or not supported:", e);
        }
    };

    // Trigger full notification cycle
    const triggerAlert = (newAlert: TradeAlert) => {
        // 1. Play synthetic sound chime
        playChimeSound();

        // 2. Trigger desktop notification if granted
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
                const bodyText = `${newAlert.action} ${newAlert.symbol} $${newAlert.strike} ${newAlert.type} (Expiry: ${newAlert.expiration}) with +${newAlert.edgePercent}% Vol Edge!`;
                new Notification(`🔥 Profitable Trade Alert!`, {
                    body: bodyText,
                    silent: true // We play our custom chime instead
                });
            } catch (err) {
                console.error("Failed to trigger desktop notification:", err);
            }
        }

        // 3. Show in-app UI Toast
        setAlert(newAlert);
        setIsVisible(true);

        // 4. Auto-dismiss after 9 seconds to keep UI tidy
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 9000);
    };

    const requestPermission = async () => {
        if (typeof window !== "undefined" && "Notification" in window) {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            // Play a confirmation chime
            playChimeSound();
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible || !alert) return null;

    const isBuy = alert.action === "BUY";
    const accentColorClass = isBuy ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-amber-500/50 text-amber-400 bg-amber-500/10";
    const hoverBgClass = isBuy ? "hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "hover:bg-amber-500/20 text-amber-400 border-amber-500/30";
    const glowClass = isBuy ? "shadow-cyan-900/30" : "shadow-amber-900/30";

    return (
        <div className="fixed bottom-24 right-6 z-[100] max-w-sm w-full animate-in slide-in-from-right-12 fade-in duration-500">
            <div className={`bg-slate-900/95 border rounded-2xl p-5 shadow-2xl ${glowClass} backdrop-blur-xl relative overflow-hidden group border-slate-800`}>
                
                {/* Visual Glow Indicator */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-20 transition-all duration-700 ${isBuy ? 'bg-cyan-500' : 'bg-amber-500'}`} />

                {/* Header Row */}
                <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-2 font-black tracking-widest text-[10px] uppercase">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBuy ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isBuy ? 'bg-cyan-500' : 'bg-amber-500'}`}></span>
                        </span>
                        <span className={isBuy ? "text-cyan-400" : "text-amber-400"}>
                            {alert.isSimulated ? "DEMO SCANNER" : "LIVE SCANNER"} • ALGO DISCOVERY
                        </span>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Details Card */}
                <div className="space-y-3 relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-extrabold text-lg flex items-center gap-1.5">
                                {alert.symbol}
                                <span className={`text-xs px-2 py-0.5 rounded-md border font-black uppercase ${accentColorClass}`}>
                                    {alert.action}
                                </span>
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5 font-medium font-mono">
                                Strike ${alert.strike} {alert.type} • {alert.expiration}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className={`text-2xl font-black italic tracking-tight ${isBuy ? "text-cyan-400" : "text-amber-400"}`}>
                                +{alert.edgePercent}%
                            </span>
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-wide">Expected Edge</p>
                        </div>
                    </div>

                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-300 font-medium leading-relaxed font-sans">
                        {isBuy ? (
                            <span>
                                Volatility is highly underpriced. Implied Volatility (IV) is only <strong className="text-cyan-400 font-bold">{alert.iv}%</strong> while realized 30-day Historical Volatility (HV) sits at <strong className="text-white font-bold">{alert.hv}%</strong>. Contract trades at a steep discount.
                            </span>
                        ) : (
                            <span>
                                Implied Volatility is significantly inflated. IV is <strong className="text-amber-400 font-bold">{alert.iv}%</strong> vs realized HV of <strong className="text-white font-bold">{alert.hv}%</strong>. Selling premium or credit spreads offers a high mathematical advantage.
                            </span>
                        )}
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-4 text-[10px] text-slate-500 font-mono">
                            <div>
                                <span className="text-slate-400">Vol:</span> {alert.volume}
                            </div>
                            <div>
                                <span className="text-slate-400">OI:</span> {alert.openInterest}
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                // Add details alert to squawk box if desired, or open tab
                                window.location.hash = "#scanner";
                                handleDismiss();
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-800 hover:border-slate-700 transition-all`}
                        >
                            Open Scanner <ArrowRight className="h-3 w-3" />
                        </button>
                    </div>

                    {/* Notifications Authorization Banner */}
                    {notificationPermission === "default" && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                <Bell className="h-3 w-3 text-cyan-400" />
                                Get desktop alerts for background trades
                            </span>
                            <button
                                onClick={requestPermission}
                                className="px-2.5 py-1 bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-wider rounded transition-colors"
                            >
                                Enable
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
