"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, BellOff, ArrowUpRight, ArrowDownRight, X, Download, Filter, Trash2, ChevronDown } from "lucide-react";
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
    receivedAt?: number;
}

interface AlertHistoryPanelProps {
    onNewAlert?: (alert: TradeAlert) => void;
    onUnreadCountChange?: (count: number) => void;
}

export function AlertHistoryPanel({ onNewAlert, onUnreadCountChange }: AlertHistoryPanelProps) {
    const [alerts, setAlerts] = useState<TradeAlert[]>([]);
    const [filter, setFilter] = useState<"all" | "BUY" | "SELL">("all");
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef<Socket | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const lastOpenedAt = useRef<number>(Date.now());

    useEffect(() => {
        const socket = io(window.location.origin);
        socketRef.current = socket;

        socket.on("profitable_trade_alert", (newAlert: TradeAlert) => {
            const enriched = { ...newAlert, receivedAt: Date.now() };
            setAlerts(prev => [enriched, ...prev].slice(0, 50)); // Keep last 50
            setUnreadCount(prev => {
                const next = prev + 1;
                onUnreadCountChange?.(next);
                return next;
            });
            onNewAlert?.(enriched);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Reset unread when opened
    useEffect(() => {
        if (isOpen) {
            lastOpenedAt.current = Date.now();
            setUnreadCount(0);
            onUnreadCountChange?.(0);
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const filteredAlerts = alerts.filter(a => filter === "all" || a.action === filter);

    const exportCSV = () => {
        const headers = ["Time", "Symbol", "Action", "Type", "Strike", "Expiration", "Market $", "BS Price $", "IV%", "HV%", "Edge%", "Volume", "OI", "Simulated"];
        const rows = alerts.map(a => [
            a.timestamp,
            a.symbol,
            a.action,
            a.type,
            a.strike,
            a.expiration,
            a.marketPrice,
            a.theoreticalPrice,
            a.iv,
            a.hv,
            a.edgePercent,
            a.volume,
            a.openInterest,
            a.isSimulated ? "Yes" : "No"
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `options-alerts-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const timeAgo = (ts: number) => {
        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Trigger Button */}
            <button
                id="alert-history-bell"
                onClick={() => setIsOpen(v => !v)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-bold ${
                    isOpen
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                        : unreadCount > 0
                        ? "bg-slate-800 border-cyan-500/40 text-white animate-pulse"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
            >
                {unreadCount > 0 ? <Bell className="h-4 w-4 text-cyan-400" /> : <BellOff className="h-4 w-4" />}
                <span className="hidden sm:inline">Alerts</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-cyan-500 text-white text-[10px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[95vw] z-[200] bg-slate-950/98 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
                        <div>
                            <h3 className="text-white font-black text-sm flex items-center gap-2">
                                <Bell className="h-4 w-4 text-cyan-400" />
                                Live Alert Feed
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold uppercase tracking-wider border border-cyan-500/30">
                                    {alerts.length} captured
                                </span>
                            </h3>
                            <p className="text-slate-500 text-[10px] mt-0.5">Real-time +EV options discovered by algo scanner</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {alerts.length > 0 && (
                                <button
                                    onClick={exportCSV}
                                    title="Export as CSV"
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            )}
                            {alerts.length > 0 && (
                                <button
                                    onClick={() => setAlerts([])}
                                    title="Clear all alerts"
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/60">
                        {(["all", "BUY", "SELL"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    filter === f
                                        ? f === "BUY"
                                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                            : f === "SELL"
                                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "bg-white/10 text-white border border-white/20"
                                        : "text-slate-500 hover:text-slate-300"
                                }`}
                            >
                                {f === "all" ? `All (${alerts.length})` : `${f} (${alerts.filter(a => a.action === f).length})`}
                            </button>
                        ))}
                    </div>

                    {/* Alert List */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {filteredAlerts.length === 0 ? (
                            <div className="text-center py-12 text-slate-600">
                                <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium text-slate-500">No alerts yet</p>
                                <p className="text-[11px] text-slate-600 mt-1">Scanner runs every 60s — next check incoming</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/60">
                                {filteredAlerts.map((a, idx) => {
                                    const isBuy = a.action === "BUY";
                                    return (
                                        <div
                                            key={`${a.contractSymbol}-${a.receivedAt}-${idx}`}
                                            className={`px-4 py-3 hover:bg-slate-900/50 transition-colors group ${
                                                idx === 0 ? "bg-slate-900/30" : ""
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Action Badge */}
                                                    <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-[9px] font-black border ${
                                                        isBuy
                                                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                                                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                    }`}>
                                                        {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                    </div>

                                                    {/* Alert Details */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-white font-black text-sm">{a.symbol}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase border ${
                                                                isBuy
                                                                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                            }`}>
                                                                {a.action}
                                                            </span>
                                                            {a.isSimulated && (
                                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700 uppercase font-bold">
                                                                    Demo
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-slate-400 text-[10px] font-mono mt-0.5 truncate">
                                                            ${a.strike} {a.type} • Exp {a.expiration}
                                                        </p>
                                                        <p className="text-slate-600 text-[9px] mt-0.5">
                                                            IV {a.iv}% vs HV {a.hv}% • Vol {a.volume.toLocaleString()} • OI {a.openInterest.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Edge + Time */}
                                                <div className="text-right shrink-0">
                                                    <p className={`text-lg font-black italic ${isBuy ? "text-cyan-400" : "text-amber-400"}`}>
                                                        +{a.edgePercent}%
                                                    </p>
                                                    <p className="text-[9px] text-slate-600 mt-0.5">
                                                        {a.receivedAt ? timeAgo(a.receivedAt) : a.timestamp}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {alerts.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
                            <span className="text-[10px] text-slate-600">
                                {alerts.filter(a => a.isSimulated).length} demo • {alerts.filter(a => !a.isSimulated).length} live
                            </span>
                            <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse inline-block" />
                                Scanner active
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
