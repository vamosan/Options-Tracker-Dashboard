"use client";

import React, { useState, useEffect, useCallback } from "react";
import useSWR from 'swr';
import { TradeForm } from "@/components/TradeForm";
import { PositionsTable } from "@/components/PositionsTable";
import { Position, Trade } from "@/lib/types";
import { fetchOptionPrice, getPortfolioData, savePositions, saveHistory, listProfiles, deleteTrade, analyzeTrade } from "./actions";
import { getRecommendation } from "@/lib/intelligence";
import { Activity, DollarSign, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, BarChart2, Calendar, Bot, Home as HomeIcon, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSelector } from "@/components/ProfileSelector";
import { GeneralGeminiChat } from "@/components/GeneralGeminiChat";
import dynamic from "next/dynamic";
const MarketHeatmap = dynamic(() => import("@/components/MarketHeatmap").then((mod) => mod.MarketHeatmap), { ssr: false });
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { ChatBox } from "@/components/ChatBox";
import { AlertHistoryPanel } from "@/components/AlertHistoryPanel";
import { AlpacaBotDashboard } from "@/components/AlpacaBotDashboard";

const LOCAL_STORAGE_KEY = 'options_tracker_positions';
const CLOSED_POSITIONS_KEY = 'options_tracker_closed';
const MANUAL_PRICES_KEY = 'options_tracker_overrides';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'alpaca' | 'dashboard'>('alpaca');
  const [alpacaTab, setAlpacaTab] = useState<"SETUPS" | "CALENDAR" | "POSITIONS" | "SIGNALS" | "ANALYTICS" | "LOGS">("SETUPS");
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("default");
  const [isGeneralChatOpen, setIsGeneralChatOpen] = useState(false);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false);
  const [selectedPositionForReview, setSelectedPositionForReview] = useState<Position | null>(null);

  // Track which user matches the current local state to prevent race conditions
  const loadedUser = React.useRef<string | null>(null);

  const [totalValue, setTotalValue] = useState(0);
  const [totalPL, setTotalPL] = useState(0);
  const [totalPLPercent, setTotalPLPercent] = useState(0);
  const [totalDelta, setTotalDelta] = useState(0);
  const [totalTheta, setTotalTheta] = useState(0);

  // Sync username from LocalStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("options-username");
    if (savedUser) {
      setUsername(savedUser);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    const data = await getPortfolioData(username);

    // Apply any saved manual overrides from localStorage
    let storedOverrides: Record<string, number> = {};
    try {
      const stored = localStorage.getItem(MANUAL_PRICES_KEY);
      if (stored) storedOverrides = JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse manual overrides from localStorage", e);
    }

    const mergedPositions = data.positions.map((pos) => {
      const overridePrice = storedOverrides[pos.id];
      if (overridePrice !== undefined) {
        return {
          ...pos,
          currentPrice: overridePrice,
          marketValue: overridePrice * pos.quantity * 100,
          pl: (overridePrice - pos.premium) * pos.quantity * 100,
          isManualOverride: true,
          lastUpdated: new Date().toLocaleTimeString(),
        };
      }
      return pos;
    });

    setPositions(mergedPositions);
    setClosedPositions(data.history);
    loadedUser.current = username;
    setLoading(false);
  }, [username]);

  // Load data whenever username changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save to Server
  useEffect(() => {
    // ONLY save if we are not loading AND the current state belongs to the active username
    if (!loading && username && loadedUser.current === username) {
      savePositions(username, positions);
      saveHistory(username, closedPositions);
    }
  }, [positions, closedPositions, loading, username]);

  const handleUserChange = (newUser: string) => {
    setUsername(newUser);
    localStorage.setItem("options-username", newUser);
  };

  const handleAddTrade = async (trade: Trade) => {
    // Fetch real price initially
    const livePrice = await fetchOptionPrice(trade.symbol, trade.type, trade.strike, trade.expiration);
    const price = livePrice !== null ? livePrice : trade.premium; // Fallback to premium if fetch fails

    const newPosition: Position = {
      ...trade,
      currentPrice: price,
      marketValue: price * trade.quantity * 100,
      pl: (price - trade.premium) * trade.quantity * 100,
      status: 'OPEN',
      lastUpdated: new Date().toLocaleTimeString(),
    };

    setPositions((prev) => [...prev, newPosition]);
  };

  const handleRemoveTrade = async (id: string, deleteFromDb = true) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));

    // Clean up local storage override
    try {
      const stored = localStorage.getItem(MANUAL_PRICES_KEY);
      if (stored) {
        const overrides = JSON.parse(stored);
        if (overrides[id] !== undefined) {
          delete overrides[id];
          localStorage.setItem(MANUAL_PRICES_KEY, JSON.stringify(overrides));
        }
      }
    } catch (e) {
      console.warn("Failed to clean up manual override from localStorage", e);
    }

    if (deleteFromDb) {
      await deleteTrade(id);
    }
  };

  const handleSellTrade = (position: Position, manualExitPrice?: number) => {
    // Use manual price if provided, otherwise current price
    const exitPrice = manualExitPrice ?? position.currentPrice;
    const realizedPl = (exitPrice - position.premium) * position.quantity * 100;

    const closedPosition: Position = {
      ...position,
      status: 'CLOSED',
      exitPrice,
      exitDate: new Date().toISOString(),
      realizedPl,
    };

    setClosedPositions((prev) => [closedPosition, ...prev]);
    // Don't delete from DB, because saveHistory will update this record's status to CLOSED
    handleRemoveTrade(position.id, false);
  };

  const handleDeleteHistory = async (id: string) => {
    setClosedPositions((prev) => prev.filter((p) => p.id !== id));
    await deleteTrade(id);
  };

  const handleManualPriceUpdate = async (id: string, newPrice: number) => {
    // Save to local storage
    try {
      const stored = localStorage.getItem(MANUAL_PRICES_KEY);
      const overrides = stored ? JSON.parse(stored) : {};
      overrides[id] = newPrice;
      localStorage.setItem(MANUAL_PRICES_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.warn("Failed to save manual override to localStorage", e);
    }

    setPositions((prev) =>
      prev.map((pos) => {
        if (pos.id === id) {
          const marketValue = newPrice * pos.quantity * 100;
          const pl = (newPrice - pos.premium) * pos.quantity * 100;
          return {
            ...pos,
            currentPrice: newPrice,
            marketValue,
            pl,
            isManualOverride: true,
            lastUpdated: new Date().toLocaleTimeString(),
          };
        }
        return pos;
      })
    );
  };

  const updatePrices = useCallback(async () => {
    if (positions.length === 0) return;

    const updatedPositions = await Promise.all(
      positions.map(async (pos) => {
        // If the user manually set this price, do NOT poll for it anymore
        if (pos.isManualOverride) {
          return pos;
        }

        const currentPrice = await fetchOptionPrice(pos.symbol, pos.type, pos.strike, pos.expiration) ?? pos.currentPrice;

        const marketValue = currentPrice * pos.quantity * 100;
        const pl = (currentPrice - pos.premium) * pos.quantity * 100;

        // Calculate AI recommendation & Greeks for the table (still server-side)
        const analysis = await analyzeTrade({ ...pos, currentPrice, marketValue, pl });

        return {
          ...pos,
          currentPrice,
          marketValue,
          pl,
          greeks: analysis.greeks,
          recommendation: {
            signal: analysis.recommendation,
            color: analysis.statusColor
          },
          lastUpdated: new Date().toLocaleTimeString(),
        };
      })
    );

    setPositions(updatedPositions);
    setLastUpdated(new Date().toLocaleTimeString());
  }, [positions]);

  // Poll for Options Updates
  useEffect(() => {
    if (positions.length === 0) return;
    const optionsInterval = setInterval(updatePrices, 15000);

    return () => {
      clearInterval(optionsInterval);
    };
  }, [updatePrices, positions.length]);

  // Dashboard Aggregates
  useEffect(() => {
    const newTotalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + (p.premium * p.quantity * 100), 0);
    const newTotalPL = newTotalValue - totalCost;
    const newTotalPLPercent = totalCost > 0 ? (newTotalPL / totalCost) * 100 : 0;

    const newTotalDelta = positions.reduce((sum, p) => sum + (p.greeks?.delta || 0) * (p.quantity * 100), 0);
    const newTotalTheta = positions.reduce((sum, p) => sum + (p.greeks?.theta || 0) * (p.quantity * 100), 0);

    setTotalValue(newTotalValue);
    setTotalPL(newTotalPL);
    setTotalPLPercent(newTotalPLPercent);
    setTotalDelta(newTotalDelta);
    setTotalTheta(newTotalTheta);
  }, [positions]);

  // Realized P&L
  const totalRealizedPL = closedPositions.reduce((sum, p) => sum + (p.realizedPl || 0), 0);

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="w-full p-4 sm:p-8 md:p-12 max-w-[1300px] space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              OptionsTracker
            </h1>
            <p className="text-slate-400 mt-1">Real-time portfolio analytics</p>
          </div>
          <div className="flex flex-row flex-wrap items-center justify-start md:justify-end gap-2 md:gap-3 w-full pb-2 md:pb-0">
            {/* 1. HOME (Alpaca Institutional Bot Desk) */}
            <button
              onClick={() => {
                setActiveTab("alpaca");
                setAlpacaTab("SETUPS");
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all group shadow-[0_0_10px_rgba(0,0,0,0.2)] ${
                activeTab === "alpaca" && alpacaTab !== "CALENDAR"
                  ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 font-bold"
                  : "bg-slate-900/50 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="text-xs font-black uppercase tracking-tight">Home</span>
            </button>

            {/* 2. CALENDAR (Direct Access to 3-Month Performance Calendar) */}
            <button
              onClick={() => {
                setActiveTab("alpaca");
                setAlpacaTab("CALENDAR");
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all group shadow-[0_0_10px_rgba(16,185,129,0.1)] ${
                activeTab === "alpaca" && alpacaTab === "CALENDAR"
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold"
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-tight">Calendar</span>
            </button>

            {/* 3. PORTFOLIO (Trade Execution, Active Positions & Greek Risk) */}
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all group shadow-[0_0_10px_rgba(0,0,0,0.2)] ${
                activeTab === "dashboard"
                  ? "bg-violet-500/10 border-violet-500/50 text-violet-400 font-bold"
                  : "bg-slate-900/50 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-violet-400"
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-xs font-black uppercase tracking-tight">Portfolio</span>
            </button>

            {/* 4. ALERTS (Notification Panel) */}
            <AlertHistoryPanel />

            <div className="h-5 w-px bg-slate-800 mx-1 flex-shrink-0" />

            {/* 5. GEMINI AI COPILOT */}
            <button
              onClick={() => setIsGeneralChatOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-400 transition-all group shadow-[0_0_10px_rgba(79,70,229,0.1)]"
            >
              <Bot className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-tight hidden sm:inline">Gemini</span>
            </button>

            <div className="flex items-center gap-1.5 ml-auto pl-1.5 border-l border-slate-800">
              <ProfileSelector currentUser={username} onUserChange={handleUserChange} />
              <div suppressHydrationWarning className={`hidden md:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border ${lastUpdated ? "text-cyan-400 bg-cyan-950/30 border-cyan-500/20" : "text-slate-500 border-slate-800"}`}>
                <Activity className={`h-2.5 w-2.5 ${lastUpdated ? "animate-pulse" : ""}`} />
                {lastUpdated ? `Updated: ${lastUpdated}` : "Waiting..."}
              </div>
            </div>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <div className="space-y-12 w-full animate-in slide-in-from-bottom max-w-[1400px]">
            {/* Live Ticker Heatmap - Market Overview */}
            <MarketHeatmap />

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-cyan-500/20 bg-slate-900/60 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Portfolio Risk</CardTitle>
                  <Activity className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-2xl font-black text-white italic">Δ {totalDelta.toFixed(1)}</div>
                      <p className="text-[10px] text-slate-500 uppercase font-black">Total Delta</p>
                    </div>
                    <div className="h-8 w-px bg-slate-800" />
                    <div>
                      <div className="text-2xl font-black text-white italic">Θ {totalTheta.toFixed(1)}</div>
                      <p className="text-[10px] text-slate-500 uppercase font-black">Total Theta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/20 bg-slate-900/60 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Total Equity</CardTitle>
                  <Wallet className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">${totalValue.toFixed(2)}</div>
                  <p className="text-xs text-slate-500 mt-1">Current market value</p>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/20 bg-slate-900/60 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Unrealized P&L</CardTitle>
                  <DollarSign className={`h-4 w-4 ${totalPL >= 0 ? "text-green-400" : "text-red-400"}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${totalPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalPL >= 0 ? "+" : ""}{totalPL.toFixed(2)}
                  </div>
                  <p className={`text-xs mt-1 ${totalPL >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                    {totalPLPercent > 0 ? "+" : ""}{totalPLPercent.toFixed(2)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/20 bg-slate-900/60 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Realized P&L</CardTitle>
                  <History className="h-4 w-4 text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${totalRealizedPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalRealizedPL >= 0 ? "+" : ""}{totalRealizedPL.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Closed positions</p>
                </CardContent>
              </Card>
            </div>


            <div className="space-y-12 w-full animate-in slide-in-from-bottom">
              {/* Trade Entry Section - Top Compact */}
              <section className="bg-slate-950/30 p-6 rounded-2xl border border-slate-800/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                  <h2 className="text-xl font-bold text-white tracking-tight">Trade Execution</h2>
                </div>
                <TradeForm onAddTrade={handleAddTrade} />
              </section>

              {/* Active Positions - Full Width */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white tracking-tight">Active Portfolio</h2>
                </div>
                <div className="bg-slate-900/40 backdrop-blur rounded-xl p-1 border border-slate-800/50 shadow-2xl">
                  <PositionsTable
                    positions={positions}
                    onRemoveTrade={handleRemoveTrade}
                    onSellTrade={handleSellTrade}
                    onReviewTrade={(pos) => {
                      setSelectedPositionForReview(pos);
                      setIsGeneralChatOpen(true);
                    }}
                    onManualPriceUpdate={handleManualPriceUpdate}
                  />
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "alpaca" && (
          <div className="animate-in slide-in-from-bottom max-w-[1400px]">
            <AlpacaBotDashboard currentTab={alpacaTab} onTabChange={setAlpacaTab} />
          </div>
        )}

        <GeneralGeminiChat
          isOpen={isGeneralChatOpen}
          onClose={() => setIsGeneralChatOpen(false)}
        />

        <MonthlyAnalytics
          isOpen={isMonthlyOpen}
          onClose={() => setIsMonthlyOpen(false)}
          closedPositions={closedPositions}
        />

        {/* Floating Home Button — visible when viewing Portfolio */}
        {activeTab === 'dashboard' && (
          <button
            onClick={() => {
              setActiveTab('alpaca');
              setAlpacaTab('SETUPS');
            }}
            title="Return to Home Desk"
            className="fixed bottom-6 left-6 z-[150] flex items-center gap-2 px-4 py-3 bg-slate-900/95 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-200 group hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
          >
            <HomeIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Home</span>
          </button>
        )}

        <ChatBox />
      </div>
    </main>
  );
}
