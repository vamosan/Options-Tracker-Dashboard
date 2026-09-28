"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, Clock, TrendingUp, TrendingDown, Target, ShieldCheck, 
  Send, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight,
  Sliders, Info, Activity, Flame, DollarSign, Layers, AlertCircle
} from "lucide-react";
import { SPXPowerHourState } from "@/lib/spxPowerHour";

export function SPXPowerHourDesk() {
  const [data, setData] = useState<SPXPowerHourState | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateMode, setSimulateMode] = useState<"LIVE" | "SIMULATE_MOC_BUY" | "SIMULATE_MOC_SELL">("LIVE");
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);
  const [discordNotice, setDiscordNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [executingOrder, setExecutingOrder] = useState<string | null>(null);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      let url = "/api/spx-powerhour";
      if (simulateMode === "SIMULATE_MOC_BUY") {
        url += "?phase=MOC_EXECUTION&moc=BUY";
      } else if (simulateMode === "SIMULATE_MOC_SELL") {
        url += "?phase=MOC_EXECUTION&moc=SELL";
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch SPX Power Hour data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 15-second refresh
    return () => clearInterval(interval);
  }, [simulateMode]);

  const handleSendDiscord = async (setupType?: "MOC_GAMMA_CALL" | "MOC_GAMMA_PUT") => {
    if (!data) return;
    setIsSendingDiscord(true);
    setDiscordNotice(null);

    const sig = data.directSignal;
    const isCall = setupType ? setupType === "MOC_GAMMA_CALL" : sig?.direction === "CALL";
    const strike = sig?.bestStrike || 7695;
    const contract = sig?.contractName || `SPX 0DTE ${strike} ${isCall ? "CALL" : "PUT"}`;

    const payload = {
      setupType: isCall ? ("MOC_GAMMA_CALL" as const) : ("MOC_GAMMA_PUT" as const),
      triggerTime: data.currentTimeET,
      spxSpot: data.spxSpot,
      contract,
      strike,
      entryAsk: sig?.entryAsk || 3.70,
      target1: sig?.target1 || 8.14,
      target2: sig?.target2 || 16.65,
      stopLoss: sig?.stopLoss || 1.11,
      maxRiskPerContract: sig?.maxRiskDollars || 370,
      mocImbalance: data.mocImbalance.rawText,
      mocImbalanceType: data.mocImbalance.direction,
      morningBias: `${data.morningMomentumBias.bias} (${data.morningMomentumBias.first30mReturnPct > 0 ? "+" : ""}${data.morningMomentumBias.first30mReturnPct}%)`,
      shelfBreak: sig?.triggerRule || (isCall ? `Break above $${data.rangeShelf.high30}` : `Break below $${data.rangeShelf.low30}`),
      confluenceConviction: `${sig?.confidencePct || 72}% Probability (${sig?.status === "ACTIVE_TRIGGERED" ? "ACTIVE TRIGGER" : "ARMED ON TRIGGER"})`,
      exitCutoff: "3:58 PM ET"
    };

    try {
      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "spx-powerhour",
          payload
        })
      });

      const resData = await res.json();
      if (resData.success) {
        setDiscordNotice({
          message: `⚡ SPX Power Hour call-out sent to Discord for ${payload.contract}!`,
          type: "success"
        });
      } else {
        setDiscordNotice({
          message: `Discord dispatch error: ${resData.error || "Failed to deliver"}`,
          type: "error"
        });
      }
    } catch (e: any) {
      setDiscordNotice({
        message: `Network error sending alert: ${e.message}`,
        type: "error"
      });
    } finally {
      setIsSendingDiscord(false);
      setTimeout(() => setDiscordNotice(null), 7000);
    }
  };

  const handleExecutePaperOrder = (contractDesc: string, costDollars: number) => {
    setExecutingOrder(contractDesc);
    setExecutionNotice(null);

    setTimeout(() => {
      setExecutingOrder(null);
      setExecutionNotice(`✓ Paper Trade Filled: 2x ${contractDesc} @ $${costDollars / 100} ($${costDollars * 2} max risk). Hard stop 3:58 PM.`);
      setTimeout(() => setExecutionNotice(null), 8000);
    }, 1200);
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono font-bold flex items-center justify-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
        Initializing SPX 0DTE Power Hour Quantitative Tape...
      </div>
    );
  }

  const sig = data?.directSignal;
  const isCall = sig?.direction === "CALL";

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-16">
      {/* 1. Header with Live Status & Controls */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-amber-400 fill-current" />
              0DTE POWER HOUR PREDICTOR
            </span>
            <span className="text-xs font-mono text-slate-400">Cash-Settled SPX • Hard Stop 3:58 PM ET</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            ⚡ SPX Power Hour Direction &amp; Best Strike
          </h1>
        </div>

        {/* Live Index Spot & Clock */}
        <div className="flex items-center gap-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">SPX INDEX SPOT</span>
            <div className="text-xl font-mono font-black text-white flex items-center gap-1.5">
              ${data?.spxSpot?.toFixed(2)}
              <span className={`text-xs font-bold ${data?.dayChangePts && data.dayChangePts >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {data?.dayChangePts && data.dayChangePts >= 0 ? "+" : ""}{data?.dayChangePts?.toFixed(1)} ({data?.dayChangePct?.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">MARKET TIME</span>
            <div className="text-sm font-mono font-bold text-amber-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {data?.currentTimeET || "03:52 PM ET"}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher Banner (Live vs Simulations) */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <span className="text-slate-400 font-bold flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          Test Replay Controls:
        </span>
        <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
          <button
            onClick={() => setSimulateMode("LIVE")}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              simulateMode === "LIVE" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Live Market Feed
          </button>
          <button
            onClick={() => setSimulateMode("SIMULATE_MOC_BUY")}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              simulateMode === "SIMULATE_MOC_BUY" ? "bg-emerald-500 text-slate-950 font-black shadow" : "text-emerald-400 hover:text-white"
            }`}
          >
            Simulate Buy Flow (+Calls)
          </button>
          <button
            onClick={() => setSimulateMode("SIMULATE_MOC_SELL")}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              simulateMode === "SIMULATE_MOC_SELL" ? "bg-rose-500 text-white font-black shadow" : "text-rose-400 hover:text-white"
            }`}
          >
            Simulate Sell Flow (+Puts)
          </button>
        </div>
      </div>

      {/* Notices */}
      {discordNotice && (
        <div className={`p-4 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold ${
          discordNotice.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" 
            : "bg-rose-500/10 border-rose-500/40 text-rose-300"
        }`}>
          {discordNotice.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{discordNotice.message}</span>
        </div>
      )}

      {executionNotice && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{executionNotice}</span>
        </div>
      )}

      {/* 2. THE MAIN PREDICTION & BEST STRIKE CARD */}
      <div className={`p-6 sm:p-8 rounded-2xl border shadow-2xl space-y-6 ${
        isCall 
          ? "bg-gradient-to-b from-slate-900 via-emerald-950/20 to-slate-950 border-emerald-500/40 shadow-emerald-950/20" 
          : "bg-gradient-to-b from-slate-900 via-rose-950/20 to-slate-950 border-rose-500/40 shadow-rose-950/20"
      }`}>
        
        {/* Top: Big Predicted Direction Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase font-black tracking-widest block mb-1">
              PREDICTED POWER HOUR DIRECTION
            </span>
            <div className={`text-3xl sm:text-4xl font-black font-mono tracking-tight flex items-center gap-2 ${
              isCall ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sig?.directionLabel || (isCall ? "CALLS (BULLISH ↗)" : "PUTS (BEARISH ↘)")}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <span className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider border ${
              isCall 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" 
                : "bg-rose-500/20 text-rose-300 border-rose-500/50"
            }`}>
              {sig?.confidencePct || 72}% Statistical Edge
            </span>
          </div>
        </div>

        {/* Middle: The Exact Best Strike To Take */}
        <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10.5px] font-mono text-slate-400 uppercase font-black">
                SINGLE BEST STRIKE TO TAKE
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-0.5">
                {sig?.contractName}
              </div>
              <div className="text-xs font-mono text-cyan-400 mt-1">
                Retail / Small Accounts: <b>{sig?.miniContractEquivalent}</b>
              </div>
            </div>

            {/* Status Pill */}
            <div className="sm:text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider border ${
                sig?.status === "ACTIVE_TRIGGERED"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 animate-pulse"
                  : sig?.status === "SESSION_CLOSED"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/50"
              }`}>
                {sig?.status === "ACTIVE_TRIGGERED" ? "🟢 ACTIVE TRIGGERED NOW" : sig?.status === "SESSION_CLOSED" ? "SESSION CLOSED" : "⏳ ARMED — READY ON TRIGGER"}
              </span>
              <div className="text-xs font-mono text-slate-400 mt-1.5 max-w-sm">
                {sig?.statusText}
              </div>
            </div>
          </div>

          {/* Exact Execution Numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 font-mono text-center">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">ENTRY ASK</span>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                ${sig?.entryAsk?.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">${sig?.maxRiskDollars} max risk/ct</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-emerald-400 block uppercase font-bold">TARGET 1 (+120%)</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
                ${sig?.target1?.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Scale 50% profit</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-emerald-400 block uppercase font-bold">TARGET 2 (+350%)</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                ${sig?.target2?.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Trail runner</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-rose-400 block uppercase font-bold">STOP / HARD EXIT</span>
              <div className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">
                ${sig?.stopLoss?.toFixed(2)}
              </div>
              <span className="text-[10px] text-amber-300 block mt-0.5">Cutoff: 3:58 PM ET</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => handleSendDiscord(isCall ? "MOC_GAMMA_CALL" : "MOC_GAMMA_PUT")}
            disabled={isSendingDiscord}
            className="py-3.5 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Alert Discord ({sig?.direction})</span>
          </button>

          <button
            onClick={() => handleExecutePaperOrder(sig?.contractName || "", sig?.maxRiskDollars || 370)}
            disabled={executingOrder !== null}
            className={`py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
              isCall 
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950" 
                : "bg-rose-500 hover:bg-rose-400 text-white"
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{executingOrder ? "Routing Order..." : `Execute Paper (${sig?.direction})`}</span>
          </button>
        </div>
      </div>

      {/* 3. PLAIN & SIMPLE: WHY THIS TRADE IS PROFITABLE (Criteria Checkmarks) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            CRITERIA FOR PROFITABLE TRADES (WHY THIS TRADE WINS)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Strict Rules Applied</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {sig?.profitCriteria?.map((crit, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10.5px]">{crit.title}</span>
                <span className="text-emerald-400 font-black">{crit.value}</span>
              </div>
              <p className="text-slate-300 text-[11.5px] leading-relaxed">
                {crit.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
