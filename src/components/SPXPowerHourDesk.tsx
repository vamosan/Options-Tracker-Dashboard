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

  const handleSendDiscord = async (setupType: "MOC_GAMMA_CALL" | "MOC_GAMMA_PUT") => {
    if (!data) return;
    setIsSendingDiscord(true);
    setDiscordNotice(null);

    const isCall = setupType === "MOC_GAMMA_CALL";
    const targetSurge = surge || data.activeSurgeCandidate || data.callCandidate || data.putCandidate;

    if (!targetSurge) {
      setDiscordNotice({
        message: "Desk in Standby: Power Hour setups activate when a verified shelf breakout occurs. Use Test Mode in top banner to test alerts.",
        type: "error"
      });
      setIsSendingDiscord(false);
      return;
    }

    const payload = {
      setupType,
      triggerTime: data.currentTimeET,
      spxSpot: data.spxSpot,
      contract: `SPX 0DTE ${targetSurge.strike} ${targetSurge.type}`,
      strike: targetSurge.strike,
      entryAsk: targetSurge.estimatedAsk,
      target1: targetSurge.target1,
      target2: targetSurge.target2,
      stopLoss: targetSurge.stopLoss,
      maxRiskPerContract: targetSurge.maxRiskDollars,
      mocImbalance: data.mocImbalance.rawText,
      mocImbalanceType: data.mocImbalance.direction,
      morningBias: `${data.morningMomentumBias.bias} (${data.morningMomentumBias.first30mReturnPct > 0 ? "+" : ""}${data.morningMomentumBias.first30mReturnPct}%)`,
      shelfBreak: data.rangeShelf.breakoutDirection === "UPWARD_BREAKOUT" ? `Broke above H30 ($${data.rangeShelf.high30})` : `Broke below L30 ($${data.rangeShelf.low30})`,
      confluenceConviction: data.confluence?.overallConviction === "HIGH_CONVICTION" ? "HIGH CONVICTION (3-FACTOR VERIFIED)" : (data.confluence?.overallConviction || "STANDBY"),
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

  const phase = data?.phaseInfo;
  // 1-Trade Strict Discipline: surge is strictly the confirmed active breakout candidate (or null when in standby/inside shelf)
  const surge = data?.activeSurgeCandidate || null;

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header & Live Clock / Phase Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-400 fill-current" />
                QUANTITATIVE DESK
              </span>
              <span className="text-xs font-mono text-slate-400">Section 1256 • Cash Settled • European</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              ⚡ SPX 0DTE POWER HOUR DESK
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Exploit peak gamma asymmetry and the 3:50 PM NYSE Market-on-Close (MOC) institutional rebalancing surge.
            </p>
          </div>

          {/* Clock & Phase Badge */}
          <div className="flex flex-col items-start md:items-end gap-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-lg font-mono font-black text-white">{data?.currentTimeET || "03:45 PM ET"}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                phase?.phase === "MOC_EXECUTION"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 animate-pulse"
                  : phase?.phase === "PRE_MOC_PREP"
                  ? "bg-amber-500/20 border-amber-500 text-amber-300"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}>
                {phase?.badge || "ACTIVE"}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              {phase?.title}
            </div>
          </div>
        </div>

        {/* Phase Action Banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-slate-300"><b>Institutional Guidance:</b> {phase?.actionGuidance}</span>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              Replay / Test Mode:
            </span>
            <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono font-bold">
              <button
                onClick={() => setSimulateMode("LIVE")}
                className={`px-2.5 py-1 rounded transition-all ${
                  simulateMode === "LIVE" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Live Feed
              </button>
              <button
                onClick={() => setSimulateMode("SIMULATE_MOC_BUY")}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                  simulateMode === "SIMULATE_MOC_BUY" ? "bg-emerald-500 text-slate-950 font-black shadow" : "text-emerald-400 hover:text-white"
                }`}
              >
                Simulate Buy Imbalance (+$1.85B)
              </button>
              <button
                onClick={() => setSimulateMode("SIMULATE_MOC_SELL")}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                  simulateMode === "SIMULATE_MOC_SELL" ? "bg-rose-500 text-white font-black shadow" : "text-rose-400 hover:text-white"
                }`}
              >
                Simulate Sell Imbalance (-$1.45B)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notices */}
      {discordNotice && (
        <div className={`p-4 rounded-xl border flex items-center gap-2 animate-in fade-in duration-200 ${
          discordNotice.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold" 
            : "bg-rose-500/10 border-rose-500/40 text-rose-300 font-mono text-xs font-bold"
        }`}>
          {discordNotice.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{discordNotice.message}</span>
        </div>
      )}

      {executionNotice && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{executionNotice}</span>
        </div>
      )}

      {/* 2. Top Metric KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* SPX Spot */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
            SPX INDEX SPOT
          </span>
          <div className="text-3xl font-black text-white font-mono">
            {data?.spxSpot.toFixed(2)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
              (data?.dayChangePts || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {(data?.dayChangePts || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {(data?.dayChangePts || 0) >= 0 ? "+" : ""}{data?.dayChangePts.toFixed(1)} pts ({data?.dayChangePct.toFixed(2)}%)
            </span>
            <span className="text-[10px] font-mono text-slate-500">SPY ${data?.spySpot.toFixed(2)}</span>
          </div>
        </div>

        {/* NYSE MOC Imbalance Monitor */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
            NYSE MOC IMBALANCE (3:50 PM)
          </span>
          <div className={`text-2xl font-black font-mono flex items-center gap-2 ${
            data?.mocImbalance.direction === "BUY" 
              ? "text-emerald-400" 
              : data?.mocImbalance.direction === "SELL" 
              ? "text-rose-400" 
              : "text-slate-400"
          }`}>
            {data?.mocImbalance.direction === "BUY" ? "+$" : data?.mocImbalance.direction === "SELL" ? "-$" : "$"}
            {data?.mocImbalance.amountBillions.toFixed(2)}B {data?.mocImbalance.direction}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1 truncate" title={data?.mocImbalance.institutionalFlow}>
            {data?.mocImbalance.institutionalFlow}
          </div>
        </div>

        {/* Gao-Han-Li-Zhou Morning Bias */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
            JFE INTRADAY MOMENTUM BIAS
          </span>
          <div className={`text-2xl font-black font-mono ${
            data?.morningMomentumBias.bias === "BULLISH" ? "text-emerald-400" : "text-rose-400"
          }`}>
            {data?.morningMomentumBias.bias}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            First 30m Return: <b>{data?.morningMomentumBias.first30mReturnPct > 0 ? "+" : ""}{data?.morningMomentumBias.first30mReturnPct}%</b> • 66.7% trend continuation
          </div>
        </div>

        {/* Historical Edge Stats */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
            39-SESSION QUANTITATIVE EDGE
          </span>
          <div className="text-xl font-black text-amber-400 font-mono">
            97.4% Breakout Rate
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Avg Range: <b>34.2 pts</b> • Net Settle: <b>7.6 pts</b> (4.5x dislocation)
          </div>
        </div>
      </div>

      {/* 3. Range Shelf Visualizer (3:00 - 3:35 PM H30 / L30) */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              STAGE 1 RANGE SHELF (3:00 – 3:35 PM ET)
            </h3>
            <p className="text-xs text-slate-400">
              In 97.4% of sessions, SPX breaks either $H_{30}$ or $L_{30}$ during the final 30 minutes.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Spread: <b className="text-white">{data?.rangeShelf.spreadPts.toFixed(1)} pts</b></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              data?.rangeShelf.breakoutDirection === "UPWARD_BREAKOUT"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : data?.rangeShelf.breakoutDirection === "DOWNWARD_BREAKOUT"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "bg-slate-800 text-slate-300"
            }`}>
              {data?.rangeShelf.breakoutDirection.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Range Bar Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-rose-400 font-bold">L30 Support: ${data?.rangeShelf.low30.toFixed(1)}</span>
            <span className="text-cyan-400 font-bold">Current Spot: ${data?.spxSpot.toFixed(1)}</span>
            <span className="text-emerald-400 font-bold">H30 Resistance: ${data?.rangeShelf.high30.toFixed(1)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${data?.rangeShelf.currentPositionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Premier Quantitative Strategy Playbook: Directional Gamma Breakout */}
      <div className="w-full">
        {/* Playbook: Asymmetric MOC Gamma Squeeze */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  PREMIER PLAYBOOK: 1-TRADE DIRECTIONAL BREAKOUT
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border ${
                  data?.confluence?.overallConviction === "HIGH_CONVICTION"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : data?.confluence?.overallConviction === "MODERATE"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-slate-800/80 text-slate-400 border-slate-700"
                }`}>
                  {data?.confluence?.overallConviction === "HIGH_CONVICTION" ? "⚡ HIGH CONVICTION SETUP" : data?.confluence?.overallConviction === "MODERATE" ? "⚠️ MODERATE CONVICTION" : "STANDBY / MONITORING"}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {surge?.gammaLeverage || "10x - 20x Gamma Asymmetry"}
              </span>
            </div>

            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                ⚡ Asymmetric 0DTE Directional Breakout Desk
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl">
                Monitored continuously across 3:00–4:00 PM ET. Pre-cutoff entry at 3:30–3:39 PM before 15:40 broker lockout, with peak MOC institutional surge at 3:50 PM.
              </p>
            </div>

            {/* 3-Factor Institutional Confluence Verification Matrix */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  3-Factor Institutional Confluence Verification Matrix
                </span>
                <span className="text-[10px] font-mono text-slate-500">Live Validation</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                {/* Factor 1: Morning Tape Alignment */}
                <div className={`p-3 rounded-lg border space-y-1 ${
                  data?.confluence?.trendAlignment === "ALIGNED_WITH_TREND"
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : data?.confluence?.trendAlignment === "COUNTER_TREND"
                    ? "bg-amber-950/20 border-amber-500/40 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">1. Tape Trend Alignment</span>
                    <span className="text-[10px] font-bold">
                      {data?.confluence?.trendAlignment === "ALIGNED_WITH_TREND" ? "ALIGNED" : data?.confluence?.trendAlignment === "COUNTER_TREND" ? "COUNTER-TREND" : "NEUTRAL"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    {data?.confluence?.trendAlignmentMessage || "Morning momentum tape verification"}
                  </p>
                </div>

                {/* Factor 2: Shelf Clearance Buffer */}
                <div className={`p-3 rounded-lg border space-y-1 ${
                  data?.confluence?.isConfirmedClearance
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">2. Shelf Buffer (≥1.0 pt)</span>
                    <span className="text-[10px] font-bold">
                      {data?.confluence?.isConfirmedClearance ? `CLEARANCE +${data.confluence.shelfClearancePts.toFixed(1)} PTS` : `${data?.confluence?.shelfClearancePts.toFixed(1) || "0.0"} PTS (INSIDE SHELF)`}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    {data?.confluence?.isConfirmedClearance ? "Institutional buffer confirmed beyond resistance/support" : "Price oscillating inside range. Zero trades taken inside shelf."}
                  </p>
                </div>

                {/* Factor 3: NYSE MOC Imbalance Agreement */}
                <div className={`p-3 rounded-lg border space-y-1 ${
                  data?.confluence?.mocAgreement === "CONFIRMED"
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : data?.confluence?.mocAgreement === "DIVERGENT"
                    ? "bg-rose-950/20 border-rose-500/40 text-rose-300"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">3. NYSE MOC Flow</span>
                    <span className="text-[10px] font-bold">
                      {data?.confluence?.mocAgreement === "CONFIRMED" ? "AGREEMENT" : data?.confluence?.mocAgreement === "DIVERGENT" ? "DIVERGENT" : "3:50 PM RELEASE"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    {data?.confluence?.mocAgreementMessage || "Awaiting 3:50 PM NYSE Floor auction feed"}
                  </p>
                </div>
              </div>
            </div>

            {/* Broker 15:40 ET Cutoff Banner */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Broker 15:40 ET Cutoff: Webull, Robinhood, &amp; IBKR reject 0DTE orders after 15:40.</span>
              </span>
              <span className="text-[10px] text-slate-400">Optimal Window: 3:30–3:39 PM</span>
            </div>

            {/* Breakout Status & 1-Trade Rule */}
            {!surge ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                  <span>Breakout Triggers (Exact 1-Trade Rule)</span>
                  <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Inside Shelf (${data?.rangeShelf?.low30?.toFixed(1)} - ${data?.rangeShelf?.high30?.toFixed(1)})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                    <span className="text-emerald-400 text-[10px] block font-bold">▲ CALL TRIGGER</span>
                    <span className="text-white font-bold text-sm">&gt; ${data?.rangeShelf?.high30?.toFixed(1)}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Arms exactly 1 Call upon verified breach (+1.0 pt clearance)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30">
                    <span className="text-rose-400 text-[10px] block font-bold">▼ PUT TRIGGER</span>
                    <span className="text-white font-bold text-sm">&lt; ${data?.rangeShelf?.low30?.toFixed(1)}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Arms exactly 1 Put upon verified breach (-1.0 pt clearance)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-between ${
                surge.type === "CALL" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" : "bg-rose-500/10 border-rose-500/40 text-rose-300"
              }`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
                  <span>⚡ EXACTLY 1 TRADE: CONFIRMED {surge.type} BREAKOUT</span>
                </span>
                <span>{surge.triggerCondition}</span>
              </div>
            )}

            {/* Target Contract Card */}
            {!surge ? (
              <div className="p-8 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 inline-block">
                  🔒 PLAYBOOK IN STANDBY: AWAITING SHELF BREAKOUT
                </span>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  SPX Spot (${data?.spxSpot?.toFixed(2)}) is inside the 3:00–3:35 PM Shelf (${data?.rangeShelf?.low30?.toFixed(1)} - ${data?.rangeShelf?.high30?.toFixed(1)}). Strict rule: <b>ZERO trades allowed inside range</b> to prevent theta decay and fakeouts.
                </p>
                <div className="text-[11px] font-mono text-cyan-400">
                  Switch to <b>Simulate Buy Imbalance</b> or <b>Simulate Sell Imbalance</b> in the top banner to test the 1-trade breakout flow.
                </div>
              </div>
            ) : (
              <div className={`p-5 rounded-xl bg-slate-950/80 border space-y-3 ${
                surge.type === "CALL" ? "border-emerald-500/60" : "border-rose-500/60"
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">CONFIRMED 1-TRADE CONTRACT</span>
                    <div className="text-2xl font-mono font-black text-white">
                      SPX 0DTE {surge.strike} {surge.type}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">ENTRY ASK (MAX RISK)</span>
                    <div className="text-2xl font-mono font-black text-white">
                      ${surge.estimatedAsk.toFixed(2)} <span className="text-xs text-slate-400 font-normal">(${surge.maxRiskDollars}/ct)</span>
                    </div>
                  </div>
                </div>

                {surge.miniContractEquivalent && (
                  <div className="text-xs font-mono text-cyan-400 pt-2 border-t border-slate-800/40">
                    Mini Equivalent (Retail friendly): <b>{surge.miniContractEquivalent}</b>
                  </div>
                )}

                {/* Profit Targets & Stop */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase">T1 (+120%)</span>
                    <span className="text-emerald-300 font-bold text-base">${surge.target1.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Scale 50%</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase">T2 (+350%)</span>
                    <span className="text-emerald-400 font-bold text-base">${surge.target2.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Scale 25%</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-bold uppercase">STOP / CUTOFF</span>
                    <span className="text-rose-400 font-bold text-base">${surge.stopLoss.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Cut at 3:53 PM</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Triggers */}
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono flex-wrap gap-2">
              <span className="text-slate-400">Mandatory Cutoff: <b className="text-amber-400">3:58 PM ET</b></span>
              <span className="text-slate-400">Imbalance Required: <b className="text-emerald-400">&gt; $750M</b></span>
              <span className="text-slate-400">Execution Discipline: <b className="text-cyan-400">Zero Trades Inside Shelf</b></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleSendDiscord(surge?.type === "CALL" ? "MOC_GAMMA_CALL" : "MOC_GAMMA_PUT")}
                disabled={isSendingDiscord || !surge}
                className="py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{surge ? `Alert Discord (${surge.type})` : "Standby (No Alert)"}</span>
              </button>

              <button
                onClick={() => handleExecutePaperOrder(`SPX ${surge?.strike} ${surge?.type}`, surge?.maxRiskDollars || 65)}
                disabled={executingOrder !== null || !surge}
                className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{executingOrder ? "Routing..." : surge ? `Execute Paper (${surge.type})` : "Standby"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Gatekeeper 0DTE Institutional Rules Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          INSTITUTIONAL 0DTE RISK & EXECUTION GATEKEEPER
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-amber-400 font-bold block">1. FIXED 1% ALLOCATION</span>
            <p className="text-slate-400 leading-relaxed">
              Never risk more than 1% to 1.5% of total portfolio value in any single Power Hour session. If account is $25k, max risk is $250–$375 (3–5 contracts).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-rose-400 font-bold block">2. ZERO AVERAGING DOWN</span>
            <p className="text-slate-400 leading-relaxed">
              Theta acceleration is exponential in the final 30 minutes. If a trade does not expand within 3 minutes, exit for remaining value. Never add to a losing 0DTE.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-emerald-400 font-bold block">3. 3:58 PM HARD CUTOFF</span>
            <p className="text-slate-400 leading-relaxed">
              While SPX avoids physical stock assignment (cash-settled), always harvest profits between 3:55 and 3:58 PM to avoid 4:00:00 PM settlement cross variance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
