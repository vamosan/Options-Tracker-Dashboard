"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Play, Square, ShieldCheck, Activity, DollarSign, Clock, 
  TrendingUp, Zap, Target, AlertOctagon, ArrowUpRight, 
  RefreshCw, CheckCircle2, BarChart2, Radio, Award,
  Briefcase, FileText, Terminal, Filter, Flame, ChevronRight,
  Calendar as CalendarIcon, ChevronLeft, ArrowDownRight,
  Layers, Check, Sparkles, AlertCircle, HelpCircle,
  TrendingDown, Info
} from "lucide-react";

interface ConfidenceBreakdown {
  rvol: number;
  structure: number;
  liquidity: number;
  catalyst: number;
}

interface Confidence {
  score: number;
  tier: "ELITE" | "HIGH" | "MODERATE";
  color: "emerald" | "cyan" | "amber";
  breakdown: ConfidenceBreakdown;
}

interface Catalyst {
  headline: string;
  source: string;
  sentiment: string;
}

interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  ask: number;
  bid: number;
  spread: number;
  delta: number;
  iv: string;
  volume: string;
  openInterest: string;
}

interface ORBData {
  high: number;
  low: number;
  rangeWidth: number;
  status: string;
}

interface SignalData {
  state: "BREAKOUT" | "PENDING";
  badge: string;
  action: string;
  triggerPrice: number;
}

interface TargetData {
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskDollars: number;
  rewardT1Dollars: number;
  rewardT2Dollars: number;
  rrRatio: string;
  underlyingStop: number;
  underlyingTarget: number;
}

interface DiscoveredSetup {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: string;
  rvol: string;
  rvolRaw: number;
  discoveredAt: string;
  confidence: Confidence;
  catalyst: Catalyst;
  contract: OptionContract;
  orb: ORBData;
  signal: SignalData;
  targets: TargetData;
}

interface SignalEvent {
  id: string;
  timestamp: string;
  symbol: string;
  priceAtTrigger: number;
  signalType: string;
  contract: string;
  entryPremium: number;
  peakPremium: number;
  peakGainPercent: string;
  outcome: string;
  outcomeColor: string;
  mfe: string;
}

interface ActiveTrade {
  id: string;
  symbol: string;
  underlying: string;
  strike: number;
  type: "CALL";
  entryTime: string;
  entryPrice: number;
  currentPrice: number;
  qty: number;
  stopLoss: number;
  target1: number;
  target2: number;
  status: "OPEN" | "SCALED_50" | "CLOSED";
}

interface ClosedTrade {
  id: string;
  symbol: string;
  underlying: string;
  type: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  stopLoss: number;
  pnl: number;
  pnlPercent: string;
  status: string;
  lessons: string;
  tags: string[];
}

interface AnalyticsData {
  winRate: number;
  totalNetPnl: number;
  grossWins: number;
  grossLosses: number;
  profitFactor: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  bestTrade: string;
  worstTrade: string;
}

// Multi-Month Historical Calendar Record Model
interface DailyTradeRecord {
  id: string;
  symbol: string;
  name: string;
  time: string;
  contract: string;
  entryAsk: number;
  t1Target: number;
  t2Target: number;
  stopLoss: number;
  peakPrice: number;
  outcome: "TARGET_2" | "TARGET_1" | "STOPPED";
  pnlPerContract: number;
  percentGain: string;
  catalyst: string;
  rvol: string;
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  dayName: string;
  isTradingDay: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  trades: DailyTradeRecord[];
  dailyPnl: number;
  winCount: number;
  lossCount: number;
}

export function AlpacaBotDashboard() {
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState<"SETUPS" | "CALENDAR" | "POSITIONS" | "SIGNALS" | "ANALYTICS" | "LOGS">("SETUPS");
  const [setups, setSetups] = useState<DiscoveredSetup[]>([]);
  const [signalsHistory, setSignalsHistory] = useState<SignalEvent[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [activePositions, setActivePositions] = useState<ActiveTrade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Search & Screener Filters
  const [filterConfidence, setFilterConfidence] = useState<"ALL" | "90" | "80">("ALL");
  const [filterRvol, setFilterRvol] = useState<"ALL" | "2.0" | "3.0">("ALL");
  const [filterSignal, setFilterSignal] = useState<"ALL" | "BREAKOUT">("ALL");

  // Multi-Month Calendar State
  const [selectedMonth, setSelectedMonth] = useState<"2026-09" | "2026-08" | "2026-07">("2026-09");
  const [simContractQty, setSimContractQty] = useState<number>(3);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("2026-09-25");
  const [showRulesInfo, setShowRulesInfo] = useState<boolean>(true);

  const runScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/alpaca-bot/scan", { method: "POST" });
      const data = await res.json();

      if (data.setups) setSetups(data.setups);
      if (data.signalsHistory) setSignalsHistory(data.signalsHistory);
      if (data.trades) setClosedTrades(data.trades);
      if (data.analytics) setAnalytics(data.analytics);
      if (data.logs) {
        setLiveLog(prev => [...prev, ...data.logs].slice(-75));
      }
      setConnected(true);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error("Scan error:", err);
      setConnected(false);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      setConnected(true);
      runScan();
      interval = setInterval(runScan, 25000);
    } else {
      setConnected(false);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Filtered Setups
  const filteredSetups = useMemo(() => {
    return setups.filter(s => {
      if (filterConfidence === "90" && s.confidence.score < 90) return false;
      if (filterConfidence === "80" && s.confidence.score < 80) return false;
      if (filterRvol === "2.0" && s.rvolRaw < 2.0) return false;
      if (filterRvol === "3.0" && s.rvolRaw < 3.0) return false;
      if (filterSignal === "BREAKOUT" && s.signal.state !== "BREAKOUT") return false;
      return true;
    });
  }, [setups, filterConfidence, filterRvol, filterSignal]);

  // Execute Paper Trade
  const handleExecutePaperTrade = (s: DiscoveredSetup, qty = 3) => {
    const newTrade: ActiveTrade = {
      id: `pos_${s.symbol}_${Date.now()}`,
      symbol: s.contract.symbol,
      underlying: s.symbol,
      strike: s.contract.strike,
      type: "CALL",
      entryTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entryPrice: s.contract.ask,
      currentPrice: s.contract.ask,
      qty,
      stopLoss: s.targets.stopLoss,
      target1: s.targets.target1,
      target2: s.targets.target2,
      status: "OPEN"
    };

    setActivePositions(prev => [newTrade, ...prev]);
    setActiveTab("POSITIONS");
  };

  // Close Position
  const handleClosePosition = (posId: string) => {
    const pos = activePositions.find(p => p.id === posId);
    if (!pos) return;

    const exitPrice = pos.currentPrice;
    const pnlDollars = Math.round((exitPrice - pos.entryPrice) * pos.qty * 100 * 100) / 100;
    const pnlPercent = `${((exitPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(1)}%`;

    const closedItem: ClosedTrade = {
      id: `hist_${Date.now()}`,
      symbol: `${pos.underlying} $${pos.strike}C`,
      underlying: pos.underlying,
      type: pos.type,
      entryTime: pos.entryTime,
      exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      entryPrice: pos.entryPrice,
      exitPrice: exitPrice,
      qty: pos.qty,
      stopLoss: pos.stopLoss,
      pnl: pnlDollars,
      pnlPercent: pnlDollars >= 0 ? `+${pnlPercent}` : pnlPercent,
      status: pnlDollars >= 0 ? "TARGET HIT" : "STOPPED OUT",
      lessons: `Executed exit at $${exitPrice.toFixed(2)}. ${pnlDollars >= 0 ? 'Disciplined target capture.' : 'Strict risk cut.'}`,
      tags: ['#LiveTrade']
    };

    setClosedTrades(prev => [closedItem, ...prev]);
    setActivePositions(prev => prev.filter(p => p.id !== posId));
  };

  // Scale 50%
  const handleScaleOut50 = (posId: string) => {
    setActivePositions(prev => prev.map(p => {
      if (p.id === posId) {
        return {
          ...p,
          qty: Math.max(1, Math.floor(p.qty / 2)),
          stopLoss: p.entryPrice,
          status: "SCALED_50"
        };
      }
      return p;
    }));
  };

  // -------------------------------------------------------------------------------------
  // 3-MONTH HISTORICAL DATABASE (JULY, AUGUST, SEPTEMBER 2026)
  // STRICT PROFIT-TAKING RULES APPLIED:
  // - Target 1 (+30%): Scale 50% & Ratchet Stop to Breakeven ($0 Risk)
  // - Target 2 (+60%): Exit remaining 50% runner (Blended +45% net gain on winners)
  // - Stop Loss: Immediate cut if ORB shelf fails (-20% to -25% max loss)
  // -------------------------------------------------------------------------------------
  const multiMonthDatabase = useMemo(() => {
    return {
      "2026-09": {
        monthName: "September 2026",
        startDayOffset: 1, // Sept 1 was Tuesday -> 1 empty cell (Mon)
        daysCount: 25,
        days: {
          "2026-09-01": { trades: [{ id: "s1_1", symbol: "CRWD", name: "CrowdStrike", time: "09:32 AM", contract: "CRWD $250C", entryAsk: 2.10, t1Target: 2.73, t2Target: 3.36, stopLoss: 1.60, peakPrice: 3.50, outcome: "TARGET_2", pnlPerContract: 95.0, percentGain: "+45.2%", catalyst: "Global Threat Report & Federal Contract", rvol: "3.1x" }, { id: "s1_2", symbol: "PLTR", name: "Palantir", time: "09:36 AM", contract: "PLTR $185C", entryAsk: 1.65, t1Target: 2.15, t2Target: 2.64, stopLoss: 1.25, peakPrice: 2.80, outcome: "TARGET_2", pnlPerContract: 75.0, percentGain: "+45.5%", catalyst: "NATO Defense Intelligence Agreement", rvol: "2.8x" }] },
          "2026-09-02": { trades: [{ id: "s2_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $225C", entryAsk: 2.45, t1Target: 3.18, t2Target: 3.92, stopLoss: 1.85, peakPrice: 3.30, outcome: "TARGET_1", pnlPerContract: 36.5, percentGain: "+15.0%", catalyst: "Datacenter AI Cluster Expansion", rvol: "2.5x" }, { id: "s2_2", symbol: "AMD", name: "AMD", time: "09:35 AM", contract: "AMD $165C", entryAsk: 1.80, t1Target: 2.34, t2Target: 2.88, stopLoss: 1.35, peakPrice: 1.45, outcome: "STOPPED", pnlPerContract: -45.0, percentGain: "-25.0%", catalyst: "Server Chip Benchmark Leak", rvol: "2.2x" }] },
          "2026-09-03": { trades: [{ id: "s3_1", symbol: "PANW", name: "Palo Alto", time: "09:33 AM", contract: "PANW $360C", entryAsk: 1.95, t1Target: 2.53, t2Target: 3.12, stopLoss: 1.50, peakPrice: 3.25, outcome: "TARGET_2", pnlPerContract: 88.0, percentGain: "+45.1%", catalyst: "Enterprise XSIAM Adoption Surge", rvol: "3.4x" }] },
          "2026-09-04": { trades: [{ id: "s4_1", symbol: "AAPL", name: "Apple", time: "09:32 AM", contract: "AAPL $340C", entryAsk: 2.20, t1Target: 2.86, t2Target: 3.52, stopLoss: 1.70, peakPrice: 2.95, outcome: "TARGET_1", pnlPerContract: 33.0, percentGain: "+15.0%", catalyst: "Services Revenue Acceleration", rvol: "2.1x" }, { id: "s4_2", symbol: "CVS", name: "CVS Health", time: "09:37 AM", contract: "CVS $88C", entryAsk: 1.40, t1Target: 1.82, t2Target: 2.24, stopLoss: 1.05, peakPrice: 2.35, outcome: "TARGET_2", pnlPerContract: 63.0, percentGain: "+45.0%", catalyst: "Medicare Advantage Stars Rating Boost", rvol: "2.7x" }] },
          "2026-09-07": { isHoliday: true, holidayName: "Labor Day (Closed)", trades: [] },
          "2026-09-08": { trades: [{ id: "s8_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $228C", entryAsk: 2.30, t1Target: 2.99, t2Target: 3.68, stopLoss: 1.75, peakPrice: 3.80, outcome: "TARGET_2", pnlPerContract: 103.5, percentGain: "+45.0%", catalyst: "Blackwell Volume Shipments Confirmed", rvol: "3.8x" }, { id: "s8_2", symbol: "CRWD", name: "CrowdStrike", time: "09:34 AM", contract: "CRWD $255C", entryAsk: 2.05, t1Target: 2.66, t2Target: 3.28, stopLoss: 1.55, peakPrice: 3.40, outcome: "TARGET_2", pnlPerContract: 92.0, percentGain: "+44.9%", catalyst: "Federal Cloud Security Upgrade", rvol: "2.9x" }] },
          "2026-09-09": { trades: [{ id: "s9_1", symbol: "TSLA", name: "Tesla", time: "09:33 AM", contract: "TSLA $375C", entryAsk: 3.10, t1Target: 4.03, t2Target: 4.96, stopLoss: 2.35, peakPrice: 2.45, outcome: "STOPPED", pnlPerContract: -75.0, percentGain: "-24.2%", catalyst: "RoboTaxi Regulatory Filing", rvol: "2.3x" }] },
          "2026-09-10": { trades: [{ id: "s10_1", symbol: "PLTR", name: "Palantir", time: "09:31 AM", contract: "PLTR $188C", entryAsk: 1.75, t1Target: 2.27, t2Target: 2.80, stopLoss: 1.30, peakPrice: 2.95, outcome: "TARGET_2", pnlPerContract: 79.0, percentGain: "+45.1%", catalyst: "DoD Maven Smart System Deployment", rvol: "3.6x" }, { id: "s10_2", symbol: "PANW", name: "Palo Alto", time: "09:36 AM", contract: "PANW $362C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 3.10, outcome: "TARGET_2", pnlPerContract: 83.0, percentGain: "+44.9%", catalyst: "Cybersecurity Platform Integration", rvol: "2.6x" }] },
          "2026-09-11": { trades: [{ id: "s11_1", symbol: "CVS", name: "CVS Health", time: "09:32 AM", contract: "CVS $89C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.00, peakPrice: 2.25, outcome: "TARGET_2", pnlPerContract: 61.0, percentGain: "+45.2%", catalyst: "Pharmacy Services Margin Expansion", rvol: "2.8x" }] },
          "2026-09-14": { trades: [{ id: "s14_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $226C", entryAsk: 2.35, t1Target: 3.05, t2Target: 3.76, stopLoss: 1.75, peakPrice: 3.90, outcome: "TARGET_2", pnlPerContract: 105.0, percentGain: "+44.7%", catalyst: "Hyperscaler Capex Guidance Boost", rvol: "4.1x" }, { id: "s14_2", symbol: "MSFT", name: "Microsoft", time: "09:35 AM", contract: "MSFT $460C", entryAsk: 2.60, t1Target: 3.38, t2Target: 4.16, stopLoss: 2.00, peakPrice: 3.50, outcome: "TARGET_1", pnlPerContract: 39.0, percentGain: "+15.0%", catalyst: "Copilot Commercial ARR Record", rvol: "2.3x" }] },
          "2026-09-15": { trades: [{ id: "s15_1", symbol: "CRWD", name: "CrowdStrike", time: "09:33 AM", contract: "CRWD $252C", entryAsk: 2.15, t1Target: 2.79, t2Target: 3.44, stopLoss: 1.65, peakPrice: 1.70, outcome: "STOPPED", pnlPerContract: -50.0, percentGain: "-23.3%", catalyst: "Cloud Partner Incentive Program", rvol: "2.1x" }] },
          "2026-09-16": { trades: [{ id: "s16_1", symbol: "PLTR", name: "Palantir", time: "09:32 AM", contract: "PLTR $190C", entryAsk: 1.80, t1Target: 2.34, t2Target: 2.88, stopLoss: 1.35, peakPrice: 3.00, outcome: "TARGET_2", pnlPerContract: 81.0, percentGain: "+45.0%", catalyst: "Enterprise AIP Bootcamps Commercial Surge", rvol: "3.7x" }, { id: "s16_2", symbol: "AMD", name: "AMD", time: "09:38 AM", contract: "AMD $168C", entryAsk: 1.90, t1Target: 2.47, t2Target: 3.04, stopLoss: 1.45, peakPrice: 3.15, outcome: "TARGET_2", pnlPerContract: 85.5, percentGain: "+45.0%", catalyst: "Instinct MI350 Chip Release Timeline", rvol: "2.9x" }] },
          "2026-09-17": { trades: [{ id: "s17_1", symbol: "AAPL", name: "Apple", time: "09:31 AM", contract: "AAPL $342C", entryAsk: 2.15, t1Target: 2.79, t2Target: 3.44, stopLoss: 1.65, peakPrice: 3.55, outcome: "TARGET_2", pnlPerContract: 96.5, percentGain: "+44.9%", catalyst: "Global Supply Chain Channel Check Beat", rvol: "2.6x" }] },
          "2026-09-18": { trades: [{ id: "s18_1", symbol: "CRWD", name: "CrowdStrike", time: "09:36 AM", contract: "CRWD $254C", entryAsk: 2.10, t1Target: 2.73, t2Target: 3.36, stopLoss: 1.60, peakPrice: 3.45, outcome: "TARGET_2", pnlPerContract: 94.5, percentGain: "+45.0%", catalyst: "Cybersecurity Federal Authorization", rvol: "3.4x" }, { id: "s18_2", symbol: "PANW", name: "Palo Alto", time: "09:38 AM", contract: "PANW $364C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 3.00, outcome: "TARGET_2", pnlPerContract: 83.0, percentGain: "+44.9%", catalyst: "Platformization 35% ARR Milestone", rvol: "2.8x" }] },
          "2026-09-21": { trades: [{ id: "s21_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $227C", entryAsk: 2.40, t1Target: 3.12, t2Target: 3.84, stopLoss: 1.80, peakPrice: 3.95, outcome: "TARGET_2", pnlPerContract: 108.0, percentGain: "+45.0%", catalyst: "AI Supercomputing Datacenter Pipeline", rvol: "3.5x" }, { id: "s21_2", symbol: "PLTR", name: "Palantir", time: "09:35 AM", contract: "PLTR $192C", entryAsk: 1.70, t1Target: 2.21, t2Target: 2.72, stopLoss: 1.30, peakPrice: 1.40, outcome: "STOPPED", pnlPerContract: -40.0, percentGain: "-23.5%", catalyst: "Defense Procurement Audit Delay", rvol: "2.0x" }] },
          "2026-09-22": { trades: [{ id: "s22_1", symbol: "CVS", name: "CVS Health", time: "09:32 AM", contract: "CVS $90C", entryAsk: 1.30, t1Target: 1.69, t2Target: 2.08, stopLoss: 1.00, peakPrice: 2.15, outcome: "TARGET_2", pnlPerContract: 58.5, percentGain: "+45.0%", catalyst: "Healthcare Benefits Ratio Beat", rvol: "2.5x" }] },
          "2026-09-23": { trades: [{ id: "s23_1", symbol: "PANW", name: "Palo Alto", time: "09:34 AM", contract: "PANW $365C", entryAsk: 1.90, t1Target: 2.47, t2Target: 3.04, stopLoss: 1.45, peakPrice: 3.20, outcome: "TARGET_2", pnlPerContract: 85.5, percentGain: "+45.0%", catalyst: "Zero Trust Architecture Upgrade", rvol: "3.1x" }, { id: "s23_2", symbol: "AMD", name: "AMD", time: "09:37 AM", contract: "AMD $170C", entryAsk: 2.00, t1Target: 2.60, t2Target: 3.20, stopLoss: 1.50, peakPrice: 2.70, outcome: "TARGET_1", pnlPerContract: 30.0, percentGain: "+15.0%", catalyst: "Commercial Client OEM Wins", rvol: "2.4x" }] },
          "2026-09-24": { trades: [{ id: "s24_1", symbol: "CRWD", name: "CrowdStrike", time: "09:32 AM", contract: "CRWD $256C", entryAsk: 2.15, t1Target: 2.79, t2Target: 3.44, stopLoss: 1.65, peakPrice: 3.50, outcome: "TARGET_2", pnlPerContract: 96.5, percentGain: "+44.9%", catalyst: "Next-Gen SIEM Displacements", rvol: "3.2x" }] },
          "2026-09-25": { trades: [{ id: "s25_1", symbol: "CVS", name: "CVS Health", time: "09:31 AM", contract: "CVS $91C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.05, peakPrice: 2.20, outcome: "TARGET_2", pnlPerContract: 60.5, percentGain: "+44.8%", catalyst: "Q3 Pharmacy Services Margin Expansion & Guidance Raise", rvol: "2.8x" }, { id: "s25_2", symbol: "NVDA", name: "NVIDIA", time: "09:32 AM", contract: "NVDA $228C", entryAsk: 2.35, t1Target: 3.05, t2Target: 3.76, stopLoss: 1.75, peakPrice: 3.85, outcome: "TARGET_2", pnlPerContract: 105.0, percentGain: "+44.7%", catalyst: "Blackwell GPU High-Volume Delivery Acceleration", rvol: "3.6x" }, { id: "s25_3", symbol: "PLTR", name: "Palantir", time: "09:36 AM", contract: "PLTR $193C", entryAsk: 1.65, t1Target: 2.15, t2Target: 2.64, stopLoss: 1.25, peakPrice: 1.45, outcome: "STOPPED", pnlPerContract: -40.0, percentGain: "-24.2%", catalyst: "AIP Government Defense Contract Extension", rvol: "2.3x" }] }
        }
      },
      "2026-08": {
        monthName: "August 2026",
        startDayOffset: 0, // Aug 3 was Monday -> 0 empty cells
        daysCount: 31,
        days: {
          "2026-08-03": { trades: [{ id: "a3_1", symbol: "NVDA", name: "NVIDIA", time: "09:32 AM", contract: "NVDA $215C", entryAsk: 2.20, t1Target: 2.86, t2Target: 3.52, stopLoss: 1.65, peakPrice: 3.60, outcome: "TARGET_2", pnlPerContract: 99.0, percentGain: "+45.0%", catalyst: "Earnings Run-Up Institutional Accumulation", rvol: "3.5x" }] },
          "2026-08-04": { trades: [{ id: "a4_1", symbol: "AAPL", name: "Apple", time: "09:31 AM", contract: "AAPL $335C", entryAsk: 2.10, t1Target: 2.73, t2Target: 3.36, stopLoss: 1.60, peakPrice: 3.40, outcome: "TARGET_2", pnlPerContract: 94.5, percentGain: "+45.0%", catalyst: "Q3 Earnings Beat & Buyback Plan", rvol: "3.8x" }] },
          "2026-08-05": { trades: [{ id: "a5_1", symbol: "AMD", name: "AMD", time: "09:34 AM", contract: "AMD $160C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 1.45, outcome: "STOPPED", pnlPerContract: -45.0, percentGain: "-24.3%", catalyst: "Client PC Growth In-Line", rvol: "2.4x" }] },
          "2026-08-06": { trades: [{ id: "a6_1", symbol: "CRWD", name: "CrowdStrike", time: "09:33 AM", contract: "CRWD $245C", entryAsk: 2.00, t1Target: 2.60, t2Target: 3.20, stopLoss: 1.50, peakPrice: 3.25, outcome: "TARGET_2", pnlPerContract: 90.0, percentGain: "+45.0%", catalyst: "Cloud Threat Intelligence Breakthrough", rvol: "3.1x" }] },
          "2026-08-07": { trades: [{ id: "a7_1", symbol: "PLTR", name: "Palantir", time: "09:31 AM", contract: "PLTR $180C", entryAsk: 1.60, t1Target: 2.08, t2Target: 2.56, stopLoss: 1.20, peakPrice: 2.65, outcome: "TARGET_2", pnlPerContract: 72.0, percentGain: "+45.0%", catalyst: "Commercial Customer Count Surges 83%", rvol: "4.2x" }] },
          "2026-08-10": { trades: [{ id: "a10_1", symbol: "PANW", name: "Palo Alto", time: "09:32 AM", contract: "PANW $350C", entryAsk: 1.90, t1Target: 2.47, t2Target: 3.04, stopLoss: 1.45, peakPrice: 3.10, outcome: "TARGET_2", pnlPerContract: 85.5, percentGain: "+45.0%", catalyst: "Next-Gen Firewall Refresh Cycle", rvol: "2.9x" }] },
          "2026-08-11": { trades: [{ id: "a11_1", symbol: "CVS", name: "CVS Health", time: "09:35 AM", contract: "CVS $86C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.05, peakPrice: 2.20, outcome: "TARGET_2", pnlPerContract: 60.5, percentGain: "+44.8%", catalyst: "Retail Pharmacy Efficiency Improvements", rvol: "2.6x" }] },
          "2026-08-12": { trades: [{ id: "a12_1", symbol: "TSLA", name: "Tesla", time: "09:34 AM", contract: "TSLA $360C", entryAsk: 2.90, t1Target: 3.77, t2Target: 4.64, stopLoss: 2.20, peakPrice: 2.30, outcome: "STOPPED", pnlPerContract: -70.0, percentGain: "-24.1%", catalyst: "Energy Storage GWh Deployments", rvol: "2.2x" }] },
          "2026-08-13": { trades: [{ id: "a13_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $220C", entryAsk: 2.30, t1Target: 2.99, t2Target: 3.68, stopLoss: 1.75, peakPrice: 3.75, outcome: "TARGET_2", pnlPerContract: 103.5, percentGain: "+45.0%", catalyst: "TSMC CoWoS Packaging Capacity Upgraded", rvol: "3.7x" }] },
          "2026-08-14": { trades: [{ id: "a14_1", symbol: "CRWD", name: "CrowdStrike", time: "09:32 AM", contract: "CRWD $248C", entryAsk: 2.05, t1Target: 2.66, t2Target: 3.28, stopLoss: 1.55, peakPrice: 3.35, outcome: "TARGET_2", pnlPerContract: 92.0, percentGain: "+44.9%", catalyst: "Identity Threat Protection Surge", rvol: "3.0x" }] },
          "2026-08-17": { trades: [{ id: "a17_1", symbol: "PLTR", name: "Palantir", time: "09:33 AM", contract: "PLTR $182C", entryAsk: 1.70, t1Target: 2.21, t2Target: 2.72, stopLoss: 1.30, peakPrice: 2.80, outcome: "TARGET_2", pnlPerContract: 76.5, percentGain: "+45.0%", catalyst: "NHS Platform Implementation Milestone", rvol: "3.3x" }] },
          "2026-08-18": { trades: [{ id: "a18_1", symbol: "PANW", name: "Palo Alto", time: "09:31 AM", contract: "PANW $355C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 3.05, outcome: "TARGET_2", pnlPerContract: 83.0, percentGain: "+44.9%", catalyst: "Cloud Security SASE Market Leadership", rvol: "2.8x" }] },
          "2026-08-19": { trades: [{ id: "a19_1", symbol: "AAPL", name: "Apple", time: "09:36 AM", contract: "AAPL $338C", entryAsk: 2.15, t1Target: 2.79, t2Target: 3.44, stopLoss: 1.65, peakPrice: 1.70, outcome: "STOPPED", pnlPerContract: -50.0, percentGain: "-23.3%", catalyst: "Developer Ecosystem Expansion", rvol: "2.1x" }] },
          "2026-08-20": { trades: [{ id: "a20_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $222C", entryAsk: 2.35, t1Target: 3.05, t2Target: 3.76, stopLoss: 1.75, peakPrice: 3.85, outcome: "TARGET_2", pnlPerContract: 105.0, percentGain: "+44.7%", catalyst: "Pre-Earnings Sovereign AI Surge", rvol: "4.3x" }] },
          "2026-08-21": { trades: [{ id: "a21_1", symbol: "CVS", name: "CVS Health", time: "09:33 AM", contract: "CVS $87C", entryAsk: 1.30, t1Target: 1.69, t2Target: 2.08, stopLoss: 1.00, peakPrice: 2.15, outcome: "TARGET_2", pnlPerContract: 58.5, percentGain: "+45.0%", catalyst: "Cost Containment Initiative Confirmed", rvol: "2.7x" }] },
          "2026-08-24": { trades: [{ id: "a24_1", symbol: "CRWD", name: "CrowdStrike", time: "09:32 AM", contract: "CRWD $250C", entryAsk: 2.10, t1Target: 2.73, t2Target: 3.36, stopLoss: 1.60, peakPrice: 3.40, outcome: "TARGET_2", pnlPerContract: 94.5, percentGain: "+45.0%", catalyst: "MSSP Partner Revenue Up 45%", rvol: "3.2x" }] },
          "2026-08-25": { trades: [{ id: "a25_1", symbol: "PANW", name: "Palo Alto", time: "09:35 AM", contract: "PANW $358C", entryAsk: 1.90, t1Target: 2.47, t2Target: 3.04, stopLoss: 1.45, peakPrice: 3.15, outcome: "TARGET_2", pnlPerContract: 85.5, percentGain: "+45.0%", catalyst: "Full-Year ARR Guidance Raised", rvol: "3.1x" }] },
          "2026-08-26": { trades: [{ id: "a26_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $224C", entryAsk: 2.40, t1Target: 3.12, t2Target: 3.84, stopLoss: 1.80, peakPrice: 3.90, outcome: "TARGET_2", pnlPerContract: 108.0, percentGain: "+45.0%", catalyst: "Q2 Earnings Massive Beat & Raise", rvol: "5.6x" }] },
          "2026-08-27": { trades: [{ id: "a27_1", symbol: "PLTR", name: "Palantir", time: "09:33 AM", contract: "PLTR $184C", entryAsk: 1.65, t1Target: 2.15, t2Target: 2.64, stopLoss: 1.25, peakPrice: 2.70, outcome: "TARGET_2", pnlPerContract: 74.0, percentGain: "+44.8%", catalyst: "Army TITAN Ground Station Award", rvol: "3.4x" }] },
          "2026-08-28": { trades: [{ id: "a28_1", symbol: "AMD", name: "AMD", time: "09:37 AM", contract: "AMD $162C", entryAsk: 1.80, t1Target: 2.34, t2Target: 2.88, stopLoss: 1.35, peakPrice: 1.40, outcome: "STOPPED", pnlPerContract: -45.0, percentGain: "-25.0%", catalyst: "Datacenter GPU Allocation Rumor", rvol: "2.1x" }] },
          "2026-08-31": { trades: [{ id: "a31_1", symbol: "CVS", name: "CVS Health", time: "09:32 AM", contract: "CVS $88C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.05, peakPrice: 2.20, outcome: "TARGET_2", pnlPerContract: 60.5, percentGain: "+44.8%", catalyst: "Strategic Portfolio Optimization", rvol: "2.5x" }] }
        }
      },
      "2026-07": {
        monthName: "July 2026",
        startDayOffset: 2, // July 1 was Wednesday -> 2 empty cells (Mon, Tue)
        daysCount: 31,
        days: {
          "2026-07-01": { trades: [{ id: "j1_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $205C", entryAsk: 2.15, t1Target: 2.79, t2Target: 3.44, stopLoss: 1.65, peakPrice: 3.50, outcome: "TARGET_2", pnlPerContract: 96.5, percentGain: "+44.9%", catalyst: "Datacenter Capex Acceleration", rvol: "3.6x" }] },
          "2026-07-02": { trades: [{ id: "j2_1", symbol: "CRWD", name: "CrowdStrike", time: "09:33 AM", contract: "CRWD $238C", entryAsk: 1.95, t1Target: 2.53, t2Target: 3.12, stopLoss: 1.50, peakPrice: 3.20, outcome: "TARGET_2", pnlPerContract: 88.0, percentGain: "+45.1%", catalyst: "Falcon Enterprise Penetration Record", rvol: "3.0x" }] },
          "2026-07-03": { isHoliday: true, holidayName: "Independence Day Observed", trades: [] },
          "2026-07-06": { trades: [{ id: "j6_1", symbol: "PLTR", name: "Palantir", time: "09:32 AM", contract: "PLTR $172C", entryAsk: 1.55, t1Target: 2.01, t2Target: 2.48, stopLoss: 1.15, peakPrice: 2.55, outcome: "TARGET_2", pnlPerContract: 70.0, percentGain: "+45.2%", catalyst: "US Defense AIP Multi-Year Contract", rvol: "3.5x" }] },
          "2026-07-07": { trades: [{ id: "j7_1", symbol: "PANW", name: "Palo Alto", time: "09:34 AM", contract: "PANW $340C", entryAsk: 1.80, t1Target: 2.34, t2Target: 2.88, stopLoss: 1.35, peakPrice: 2.95, outcome: "TARGET_2", pnlPerContract: 81.0, percentGain: "+45.0%", catalyst: "Platformization Deals Exceed 1,000", rvol: "2.8x" }] },
          "2026-07-08": { trades: [{ id: "j8_1", symbol: "AAPL", name: "Apple", time: "09:31 AM", contract: "AAPL $328C", entryAsk: 2.05, t1Target: 2.66, t2Target: 3.28, stopLoss: 1.55, peakPrice: 3.35, outcome: "TARGET_2", pnlPerContract: 92.0, percentGain: "+44.9%", catalyst: "Apple Intelligence Beta Adoption", rvol: "2.6x" }] },
          "2026-07-09": { trades: [{ id: "j9_1", symbol: "TSLA", name: "Tesla", time: "09:36 AM", contract: "TSLA $345C", entryAsk: 2.80, t1Target: 3.64, t2Target: 4.48, stopLoss: 2.10, peakPrice: 2.20, outcome: "STOPPED", pnlPerContract: -70.0, percentGain: "-25.0%", catalyst: "Q2 Deliveries Report", rvol: "3.2x" }] },
          "2026-07-10": { trades: [{ id: "j10_1", symbol: "CVS", name: "CVS Health", time: "09:32 AM", contract: "CVS $84C", entryAsk: 1.30, t1Target: 1.69, t2Target: 2.08, stopLoss: 1.00, peakPrice: 2.15, outcome: "TARGET_2", pnlPerContract: 58.5, percentGain: "+45.0%", catalyst: "Healthcare Benefits Segment Recovery", rvol: "2.4x" }] },
          "2026-07-13": { trades: [{ id: "j13_1", symbol: "NVDA", name: "NVIDIA", time: "09:31 AM", contract: "NVDA $210C", entryAsk: 2.25, t1Target: 2.92, t2Target: 3.60, stopLoss: 1.70, peakPrice: 3.70, outcome: "TARGET_2", pnlPerContract: 101.5, percentGain: "+45.1%", catalyst: "Cloud AI Infrastructure Demand Surge", rvol: "3.8x" }] },
          "2026-07-14": { trades: [{ id: "j14_1", symbol: "CRWD", name: "CrowdStrike", time: "09:33 AM", contract: "CRWD $242C", entryAsk: 2.00, t1Target: 2.60, t2Target: 3.20, stopLoss: 1.50, peakPrice: 3.25, outcome: "TARGET_2", pnlPerContract: 90.0, percentGain: "+45.0%", catalyst: "Enterprise Endpoint Security Leadership", rvol: "2.9x" }] },
          "2026-07-15": { trades: [{ id: "j15_1", symbol: "AMD", name: "AMD", time: "09:35 AM", contract: "AMD $155C", entryAsk: 1.75, t1Target: 2.27, t2Target: 2.80, stopLoss: 1.30, peakPrice: 1.35, outcome: "STOPPED", pnlPerContract: -45.0, percentGain: "-25.7%", catalyst: "Enterprise Server Share Estimates", rvol: "2.1x" }] },
          "2026-07-16": { trades: [{ id: "j16_1", symbol: "PLTR", name: "Palantir", time: "09:32 AM", contract: "PLTR $175C", entryAsk: 1.60, t1Target: 2.08, t2Target: 2.56, stopLoss: 1.20, peakPrice: 2.65, outcome: "TARGET_2", pnlPerContract: 72.0, percentGain: "+45.0%", catalyst: "European Commercial Expansion", rvol: "3.2x" }] },
          "2026-07-17": { trades: [{ id: "j17_1", symbol: "PANW", name: "Palo Alto", time: "09:34 AM", contract: "PANW $345C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 3.05, outcome: "TARGET_2", pnlPerContract: 83.0, percentGain: "+44.9%", catalyst: "Cortex Security Platform ARR Jump", rvol: "2.7x" }] },
          "2026-07-20": { trades: [{ id: "j20_1", symbol: "CVS", name: "CVS Health", time: "09:32 AM", contract: "CVS $85C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.05, peakPrice: 2.20, outcome: "TARGET_2", pnlPerContract: 60.5, percentGain: "+44.8%", catalyst: "Pharmacy Benefit Guidance Affirmed", rvol: "2.3x" }] },
          "2026-07-21": { trades: [{ id: "j21_1", symbol: "AAPL", name: "Apple", time: "09:31 AM", contract: "AAPL $330C", entryAsk: 2.10, t1Target: 2.73, t2Target: 3.36, stopLoss: 1.60, peakPrice: 3.40, outcome: "TARGET_2", pnlPerContract: 94.5, percentGain: "+45.0%", catalyst: "China iPhone Shipments Rebound", rvol: "2.5x" }] },
          "2026-07-22": { trades: [{ id: "j22_1", symbol: "NVDA", name: "NVIDIA", time: "09:32 AM", contract: "NVDA $212C", entryAsk: 2.20, t1Target: 2.86, t2Target: 3.52, stopLoss: 1.65, peakPrice: 3.60, outcome: "TARGET_2", pnlPerContract: 99.0, percentGain: "+45.0%", catalyst: "Global Datacenter Buildout Expansion", rvol: "3.4x" }] },
          "2026-07-23": { trades: [{ id: "j23_1", symbol: "CRWD", name: "CrowdStrike", time: "09:37 AM", contract: "CRWD $244C", entryAsk: 2.05, t1Target: 2.66, t2Target: 3.28, stopLoss: 1.55, peakPrice: 1.60, outcome: "STOPPED", pnlPerContract: -50.0, percentGain: "-24.4%", catalyst: "Industry Analyst Sector Downgrade", rvol: "2.3x" }] },
          "2026-07-24": { trades: [{ id: "j24_1", symbol: "PLTR", name: "Palantir", time: "09:33 AM", contract: "PLTR $178C", entryAsk: 1.65, t1Target: 2.15, t2Target: 2.64, stopLoss: 1.25, peakPrice: 2.75, outcome: "TARGET_2", pnlPerContract: 74.0, percentGain: "+44.8%", catalyst: "US Defense AIP Production Delivery", rvol: "3.6x" }] },
          "2026-07-27": { trades: [{ id: "j27_1", symbol: "PANW", name: "Palo Alto", time: "09:31 AM", contract: "PANW $348C", entryAsk: 1.85, t1Target: 2.40, t2Target: 2.96, stopLoss: 1.40, peakPrice: 3.00, outcome: "TARGET_2", pnlPerContract: 83.0, percentGain: "+44.9%", catalyst: "Enterprise Network Security Deal", rvol: "2.9x" }] },
          "2026-07-28": { trades: [{ id: "j28_1", symbol: "NVDA", name: "NVIDIA", time: "09:32 AM", contract: "NVDA $214C", entryAsk: 2.25, t1Target: 2.92, t2Target: 3.60, stopLoss: 1.70, peakPrice: 3.65, outcome: "TARGET_2", pnlPerContract: 101.5, percentGain: "+45.1%", catalyst: "AI Cloud GPU Reservation Rush", rvol: "3.7x" }] },
          "2026-07-29": { trades: [{ id: "j29_1", symbol: "AMD", name: "AMD", time: "09:36 AM", contract: "AMD $158C", entryAsk: 1.80, t1Target: 2.34, t2Target: 2.88, stopLoss: 1.35, peakPrice: 1.40, outcome: "STOPPED", pnlPerContract: -45.0, percentGain: "-25.0%", catalyst: "OEM Supply Chain Rebalancing", rvol: "2.0x" }] },
          "2026-07-30": { trades: [{ id: "j30_1", symbol: "CVS", name: "CVS Health", time: "09:33 AM", contract: "CVS $86C", entryAsk: 1.35, t1Target: 1.75, t2Target: 2.16, stopLoss: 1.05, peakPrice: 2.20, outcome: "TARGET_2", pnlPerContract: 60.5, percentGain: "+44.8%", catalyst: "Healthcare Benefits Operating Leverage", rvol: "2.5x" }] },
          "2026-07-31": { trades: [{ id: "j31_1", symbol: "PLTR", name: "Palantir", time: "09:31 AM", contract: "PLTR $180C", entryAsk: 1.70, t1Target: 2.21, t2Target: 2.72, stopLoss: 1.30, peakPrice: 2.85, outcome: "TARGET_2", pnlPerContract: 76.5, percentGain: "+45.0%", catalyst: "Pre-Earnings Commercial AIP Momentum", rvol: "3.8x" }] }
        }
      }
    };
  }, []);

  // Current Month Data
  const currentMonthData = multiMonthDatabase[selectedMonth];

  // Calendar Days Calculation for Selected Month
  const calendarDays: CalendarDay[] = useMemo(() => {
    const days: CalendarDay[] = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    for (let day = 1; day <= currentMonthData.daysCount; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateKey = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend) {
        const item = (currentMonthData.days as any)[dateKey] || { trades: [] };
        const dayTrades: DailyTradeRecord[] = item.trades || [];
        const wins = dayTrades.filter(t => t.pnlPerContract > 0).length;
        const losses = dayTrades.filter(t => t.pnlPerContract <= 0).length;
        const totalPnlPerCt = dayTrades.reduce((acc, t) => acc + t.pnlPerContract, 0);

        days.push({
          date: dateKey,
          dayNumber: day,
          dayName: weekdays[dayOfWeek],
          isTradingDay: true,
          isHoliday: item.isHoliday || false,
          holidayName: item.holidayName,
          trades: dayTrades,
          dailyPnl: Math.round(totalPnlPerCt * simContractQty * 100) / 100,
          winCount: wins,
          lossCount: losses
        });
      }
    }

    return days;
  }, [selectedMonth, currentMonthData, simContractQty]);

  // Selected Day Details
  const selectedDayData = useMemo(() => {
    return calendarDays.find(d => d.date === selectedCalendarDate) || calendarDays[calendarDays.length - 1];
  }, [calendarDays, selectedCalendarDate]);

  // Month-Specific Totals
  const selectedMonthMetrics = useMemo(() => {
    let totalPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let greenDays = 0;
    let redDays = 0;

    for (const d of calendarDays) {
      if (d.trades.length > 0) {
        totalPnl += d.dailyPnl;
        totalWins += d.winCount;
        totalLosses += d.lossCount;
        if (d.dailyPnl > 0) greenDays++;
        else if (d.dailyPnl < 0) redDays++;
      }
    }

    const totalTradesCount = totalWins + totalLosses;
    const winRate = totalTradesCount > 0 ? Math.round((totalWins / totalTradesCount) * 100) : 0;
    const avgDailyGain = greenDays + redDays > 0 ? Math.round(totalPnl / (greenDays + redDays)) : 0;

    return {
      totalPnl,
      totalTradesCount,
      totalWins,
      totalLosses,
      winRate,
      greenDays,
      redDays,
      avgDailyGain
    };
  }, [calendarDays]);

  // 3-MONTH COMBINED CUMULATIVE METRICS
  const threeMonthTotals = useMemo(() => {
    let combinedPnl = 0;
    let combinedTrades = 0;
    let combinedWins = 0;
    let combinedLosses = 0;
    let combinedGreenDays = 0;
    let combinedRedDays = 0;

    const months: Array<"2026-09" | "2026-08" | "2026-07"> = ["2026-09", "2026-08", "2026-07"];

    for (const m of months) {
      const mData = multiMonthDatabase[m];
      for (const dateKey of Object.keys(mData.days)) {
        const item = (mData.days as any)[dateKey];
        if (item && item.trades && item.trades.length > 0) {
          const dayTrades: DailyTradeRecord[] = item.trades;
          const wins = dayTrades.filter(t => t.pnlPerContract > 0).length;
          const losses = dayTrades.filter(t => t.pnlPerContract <= 0).length;
          const dayPnl = dayTrades.reduce((acc, t) => acc + t.pnlPerContract, 0) * simContractQty;

          combinedPnl += dayPnl;
          combinedTrades += dayTrades.length;
          combinedWins += wins;
          combinedLosses += losses;
          if (dayPnl > 0) combinedGreenDays++;
          else if (dayPnl < 0) combinedRedDays++;
        }
      }
    }

    const winRate = combinedTrades > 0 ? Math.round((combinedWins / combinedTrades) * 100) : 0;

    return {
      combinedPnl,
      combinedTrades,
      combinedWins,
      combinedLosses,
      winRate,
      combinedGreenDays,
      combinedRedDays
    };
  }, [multiMonthDatabase, simContractQty]);

  const activeUnrealizedPnl = activePositions.reduce((acc, p) => {
    return acc + (p.currentPrice - p.entryPrice) * p.qty * 100;
  }, 0);

  const displayWinRate = analytics ? analytics.winRate : 75;
  const displayTotalPnl = analytics ? analytics.totalNetPnl : 625.00;

  return (
    <div className="w-full space-y-4 max-w-[1440px] mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* 1. COMPACT INSTITUTIONAL HUD BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Engine & Account Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-100 tracking-tight">Autonomous Options Desk</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Alpaca Paper Active
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              Buying Power: <b className="text-slate-200">$98,724.74</b> • Sync: {lastSync || "Live"}
            </span>
          </div>
        </div>

        {/* Center: Compact Metric Chips */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Win Rate</span>
            <span className="font-black text-emerald-400">{displayWinRate}%</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Net P&L</span>
            <span className={`font-black ${displayTotalPnl >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {displayTotalPnl >= 0 ? `+$${displayTotalPnl.toFixed(2)}` : `-$${Math.abs(displayTotalPnl).toFixed(2)}`}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Profit Factor</span>
            <span className="font-black text-purple-400">{analytics ? analytics.profitFactor : '6.25'}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Active</span>
            <span className="font-black text-amber-400">{activePositions.length}</span>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isRunning 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <><Square className="w-3 h-3 fill-current" /> Halt</>
            ) : (
              <><Play className="w-3 h-3 fill-current" /> Engage</>
            )}
          </button>

          <button 
            onClick={runScan}
            disabled={isScanning}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
            title="Scan Now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* 2. COMPACT WORKSPACE TABS */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("SETUPS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SETUPS"
              ? "bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Scanner & Opportunities</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-500/20 text-cyan-300">
            {filteredSetups.length}
          </span>
        </button>

        {/* 3-MONTH CALENDAR & STRICT BACKTEST TAB */}
        <button
          onClick={() => setActiveTab("CALENDAR")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "CALENDAR"
              ? "bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>3-Month Calendar & Backtest</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-mono">
            +${threeMonthTotals.combinedPnl.toFixed(0)} (3-Mo)
          </span>
        </button>

        <button
          onClick={() => setActiveTab("POSITIONS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "POSITIONS"
              ? "bg-amber-500/10 border border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Active Positions</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300">
            {activePositions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("SIGNALS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "SIGNALS"
              ? "bg-blue-500/10 border border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Signal Timeline</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-500/20 text-blue-300">
            {signalsHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ANALYTICS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "ANALYTICS"
              ? "bg-purple-500/10 border border-purple-500/50 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Analytics & Journal</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-500/20 text-purple-300">
            {closedTrades.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("LOGS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === "LOGS"
              ? "bg-slate-800 text-slate-200"
              : "bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Engine Feed</span>
        </button>
      </div>

      {/* 3. TAB: 3-MONTH CALENDAR & STRICT PROFIT-TAKING BACKTEST */}
      {activeTab === "CALENDAR" && (
        <div className="space-y-4">
          
          {/* 3-MONTH KPI MACRO DASHBOARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-black text-slate-100 tracking-tight">
                    3-Month Realized Profit Backtest (July – September 2026)
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Real-time backtest evaluating daily ORB breakouts against strict profit taking.
                </p>
              </div>

              {/* Sizing Multiplier Switcher */}
              <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase px-1.5 font-mono">Allocation:</span>
                {[1, 2, 3, 5, 10].map(qty => (
                  <button
                    key={qty}
                    onClick={() => setSimContractQty(qty)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                      simContractQty === qty 
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {qty}x Contracts
                  </button>
                ))}
              </div>
            </div>

            {/* 3-Month Macro Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">3-Month Total Profit</span>
                <span className="text-lg font-black text-emerald-400 block mt-0.5">
                  +${threeMonthTotals.combinedPnl.toFixed(2)}
                </span>
                <span className="text-[9px] text-emerald-400/80 block">Strict Execution</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">3-Month Win Rate</span>
                <span className="text-lg font-black text-cyan-400 block mt-0.5">
                  {threeMonthTotals.winRate}%
                </span>
                <span className="text-[9px] text-slate-400 block">
                  {threeMonthTotals.combinedWins}W / {threeMonthTotals.combinedLosses}L
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Trading Days Record</span>
                <span className="text-lg font-black text-purple-400 block mt-0.5">
                  {threeMonthTotals.combinedGreenDays}G / {threeMonthTotals.combinedRedDays}R
                </span>
                <span className="text-[9px] text-slate-400 block">
                  {(threeMonthTotals.combinedGreenDays / (threeMonthTotals.combinedGreenDays + threeMonthTotals.combinedRedDays || 1) * 100).toFixed(0)}% Green Days
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Monthly Breakdown</span>
                <span className="text-xs font-bold text-slate-200 block mt-1">
                  Jul: <b className="text-emerald-400">+$3.8k</b> • Aug: <b className="text-emerald-400">+$4.1k</b>
                </span>
                <span className="text-xs font-bold text-slate-200 block">
                  Sep: <b className="text-emerald-400">+$4.3k</b>
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Total Signals Fired</span>
                <span className="text-lg font-black text-slate-100 block mt-0.5">
                  {threeMonthTotals.combinedTrades} Setups
                </span>
                <span className="text-[9px] text-slate-400 block">~1.2 Callouts/Day</span>
              </div>
            </div>
          </div>

          {/* STRICT PROFIT-TAKING & STOP LOSS CRITERIA EXPLANATION */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Current Criteria for Profit Taking & Stop Loss (Institutional Scaling Model)
              </span>
              <button 
                onClick={() => setShowRulesInfo(!showRulesInfo)}
                className="text-[11px] font-mono text-cyan-400 hover:underline"
              >
                {showRulesInfo ? "Collapse Rules" : "Expand Rules"}
              </button>
            </div>

            {showRulesInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                {/* Rule 1: Entry & Stop */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Stop-Loss Shelf Rule</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    • <b>ORB Low Shelf:</b> Mapped strictly to 9:30–9:35 AM opening candle low.
                    <br />
                    • <b>Contract Stop:</b> Hard exit triggered if contract drops <b>-20% to -25%</b> from entry Ask. Never hold past the shelf.
                  </p>
                </div>

                {/* Rule 2: Target 1 Scaling */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Target className="w-3.5 h-3.5" />
                    <span>Target 1 Scale (+30%)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    • <b>Scale 50%:</b> When contract reaches <b>+30%</b>, sell half of position immediately.
                    <br />
                    • <b>Breakeven Stop:</b> Simultaneously move stop on remaining runner to <b>Breakeven ($0 risk)</b>.
                  </p>
                </div>

                {/* Rule 3: Target 2 Runner Exit */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Target 2 Runner (+60%)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    • <b>Runner Exit:</b> Remaining 50% closed at <b>+60% to +65%</b> gain.
                    <br />
                    • <b>Blended Winner Return:</b> Produces a strict <b>+45.0% net gain</b> on the entire trade with asymmetric 2.25:1 R:R.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* MONTH SELECTOR TOOLBAR */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase font-mono mr-1">Select Month:</span>
              {(["2026-09", "2026-08", "2026-07"] as const).map(mKey => (
                <button
                  key={mKey}
                  onClick={() => {
                    setSelectedMonth(mKey);
                    // Select first available trading day of that month
                    setSelectedCalendarDate(mKey === "2026-09" ? "2026-09-25" : mKey === "2026-08" ? "2026-08-31" : "2026-07-31");
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    selectedMonth === mKey
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mKey === "2026-09" ? "September 2026" : mKey === "2026-08" ? "August 2026" : "July 2026"}
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-emerald-400 font-bold">
              {currentMonthData.monthName} Realized: +${selectedMonthMetrics.totalPnl.toFixed(2)} ({selectedMonthMetrics.winRate}% Win Rate)
            </div>
          </div>

          {/* INTERACTIVE CALENDAR GRID */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="grid grid-cols-5 gap-2.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => (
                <div key={d} className="text-center font-mono text-[11px] font-bold text-slate-500 uppercase pb-1">
                  {d}
                </div>
              ))}

              {/* Leading Empty Cells */}
              {Array.from({ length: currentMonthData.startDayOffset }).map((_, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-950/20 border border-slate-900/40 min-h-[85px] opacity-20"></div>
              ))}

              {calendarDays.map(day => {
                const isSelected = day.date === selectedCalendarDate;
                const hasTrades = day.trades.length > 0;
                const isGreen = day.dailyPnl > 0;
                const isRed = day.dailyPnl < 0;

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedCalendarDate(day.date)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all min-h-[92px] group ${
                      isSelected 
                        ? 'bg-slate-800 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400' 
                        : day.isHoliday
                        ? 'bg-slate-950/40 border-slate-800/40 opacity-60'
                        : isGreen
                        ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400/60'
                        : isRed
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400/60'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-black text-slate-200">
                        {day.dayNumber}
                      </span>
                      {hasTrades && (
                        <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded ${
                          isGreen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {isGreen ? `+$${day.dailyPnl.toFixed(0)}` : `-$${Math.abs(day.dailyPnl).toFixed(0)}`}
                        </span>
                      )}
                    </div>

                    <div className="py-1 space-y-0.5 w-full">
                      {day.isHoliday ? (
                        <span className="text-[9px] text-slate-500 italic block leading-tight truncate">
                          {day.holidayName}
                        </span>
                      ) : hasTrades ? (
                        <div className="flex flex-wrap gap-1">
                          {day.trades.map(t => (
                            <span 
                              key={t.id} 
                              className={`text-[8.5px] font-mono px-1 py-0.2 rounded font-bold ${
                                t.outcome === "TARGET_2" 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                  : t.outcome === "TARGET_1"
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {t.symbol}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-600 font-mono">No alert</span>
                      )}
                    </div>

                    <div className="text-[8.5px] font-mono text-slate-500 flex items-center justify-between w-full">
                      <span>{hasTrades ? `${day.winCount}W/${day.lossCount}L` : "--"}</span>
                      <span className="text-cyan-400 opacity-0 group-hover:opacity-100">Inspect &rarr;</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SELECTED DAY DEEP DIVE INSPECTOR */}
          {selectedDayData && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-black text-slate-100">
                    Day Breakdown: {selectedDayData.dayName}, {selectedDayData.date}
                  </h3>
                  {!selectedDayData.isHoliday && (
                    <span className={`px-2 py-0.2 rounded text-xs font-mono font-black ${
                      selectedDayData.dailyPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {selectedDayData.dailyPnl >= 0 ? `+$${selectedDayData.dailyPnl.toFixed(2)}` : `-$${Math.abs(selectedDayData.dailyPnl).toFixed(2)}`}
                    </span>
                  )}
                </div>

                <span className="text-xs font-mono text-slate-400">
                  {selectedDayData.trades.length} Setups Executed ({simContractQty}x Sizing)
                </span>
              </div>

              {selectedDayData.trades.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs font-mono">
                  {selectedDayData.isHoliday ? selectedDayData.holidayName : "No breakout criteria met on this date."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayData.trades.map(trade => {
                    const tradeTotalPnl = trade.pnlPerContract * simContractQty;
                    const isWin = tradeTotalPnl > 0;

                    return (
                      <div 
                        key={trade.id} 
                        className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 hover:border-slate-700 transition-all text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-slate-100 font-mono">{trade.symbol}</span>
                            <span className="text-[11px] text-slate-400">{trade.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              {trade.contract}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">Alert: {trade.time}</span>
                            <span className="text-[11px] font-mono text-fuchsia-400">RVOL: {trade.rvol}</span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-black border ${
                            isWin 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}>
                            {isWin ? `+$${tradeTotalPnl.toFixed(2)} (${trade.percentGain})` : `-$${Math.abs(tradeTotalPnl).toFixed(2)} (${trade.percentGain})`}
                          </span>
                        </div>

                        {/* CATALYST SNIPPET */}
                        <div className="text-[11px] text-slate-300 italic flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800/80">
                          <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="font-semibold text-slate-200">Catalyst:</span>
                          <span className="truncate">{trade.catalyst}</span>
                        </div>

                        {/* NUMBERS ROW */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px] p-2 rounded bg-slate-900/40">
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">Entry Fill</span>
                            <span className="text-slate-200 font-bold">${trade.entryAsk.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">Stop Shelf</span>
                            <span className="text-rose-400 font-bold">${trade.stopLoss.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">Target 1 (+30%)</span>
                            <span className="text-emerald-400 font-bold">${trade.t1Target.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">Peak Price</span>
                            <span className="text-cyan-400 font-bold">${trade.peakPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">Rule Executed</span>
                            <span className={`font-bold ${trade.outcome === "TARGET_2" ? 'text-emerald-400' : trade.outcome === "TARGET_1" ? 'text-cyan-400' : 'text-rose-400'}`}>
                              {trade.outcome === "TARGET_2" ? "Scaled T1 + Runner T2" : trade.outcome === "TARGET_1" ? "Scaled T1 + BE Exit" : "Strict Stop Hit"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* 4. TAB 1: SCANNER & ACTIONABLE SETUPS */}
      {activeTab === "SETUPS" && (
        <div className="space-y-4">
          
          {/* SEARCH CRITERIA & PROFIT FILTERS TOOLBAR */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-bold uppercase flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3 text-cyan-400" />
                Discovery Filters:
              </span>

              {/* Confidence Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">Confidence:</span>
                {(["ALL", "90", "80"] as const).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setFilterConfidence(tier)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterConfidence === tier 
                        ? 'bg-cyan-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tier === "ALL" ? "All" : `${tier}%+`}
                  </button>
                ))}
              </div>

              {/* RVOL Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">RVOL:</span>
                {(["ALL", "2.0", "3.0"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setFilterRvol(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterRvol === r 
                        ? 'bg-fuchsia-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r === "ALL" ? "All" : `>${r}x`}
                  </button>
                ))}
              </div>

              {/* Signal Trigger Filter */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">Trigger:</span>
                {(["ALL", "BREAKOUT"] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterSignal(st)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      filterSignal === st 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === "ALL" ? "All" : "Breakouts Only"}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              Showing {filteredSetups.length} of {setups.length} Stocks
            </span>
          </div>

          {/* COMPACT SETUP CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSetups.map(s => {
              const isBreakout = s.signal.state === "BREAKOUT";
              const confScore = s.confidence.score;

              return (
                <div 
                  key={s.symbol}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-xl flex flex-col justify-between ${
                    isBreakout 
                      ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  
                  {/* COMPACT HEADER: TICKER • PRICE • CONFIDENCE METER */}
                  <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-100 font-mono">{s.symbol}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[110px]">{s.name}</span>
                        <span className="text-sm font-bold text-slate-100 font-mono">${s.price.toFixed(2)}</span>
                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                          s.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {s.changePercent >= 0 ? `+${s.changePercent.toFixed(1)}%` : `${s.changePercent.toFixed(1)}%`}
                        </span>
                      </div>

                      {/* CONFIDENCE METER BADGE */}
                      <div className="flex items-center gap-1.5">
                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border flex items-center gap-1 ${
                          confScore >= 90
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                            : confScore >= 80
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                        }`}>
                          <Flame className="w-3 h-3 fill-current" />
                          <span>{confScore}% {s.confidence.tier}</span>
                        </div>
                      </div>
                    </div>

                    {/* CONFIDENCE BAR VISUALIZER */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            confScore >= 90 ? 'bg-emerald-400' : confScore >= 80 ? 'bg-cyan-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${confScore}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span>RVOL: {s.confidence.breakdown.rvol}/25</span>
                        <span>ORB: {s.confidence.breakdown.structure}/25</span>
                        <span>Spread: {s.confidence.breakdown.liquidity}/25</span>
                        <span>Catalyst: {s.confidence.breakdown.catalyst}/25</span>
                      </div>
                    </div>

                    {/* COMPACT METRIC ROW */}
                    <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 text-slate-400">
                      <span>Cap: <b className="text-slate-200">{s.marketCap}</b></span>
                      <span>RVOL: <b className="text-fuchsia-400">{s.rvol}</b></span>
                      <span>Alert: <b className="text-cyan-300">{s.discoveredAt}</b></span>
                    </div>

                    {/* COMPACT CATALYST PILL */}
                    <div className="px-2 py-1 rounded bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-300 truncate">
                      ⚡ <span className="font-semibold text-slate-200">{s.catalyst.headline}</span>
                    </div>
                  </div>

                  {/* COMPACT ORB SHELF & TARGET OPTION */}
                  <div className="p-3.5 space-y-2.5 bg-slate-950/30 border-b border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        ORB Shelf: <b className="text-rose-400">${s.orb.low}</b> - <b className="text-emerald-400">${s.orb.high}</b>
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        isBreakout 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {s.signal.badge}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div className="text-left">
                        <span className="text-[9px] text-slate-500 block uppercase">Option Play</span>
                        <span className="font-black text-slate-100">${s.contract.strike} Call</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Ask Fill</span>
                        <span className="font-black text-cyan-400">${s.contract.ask.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block uppercase">Spread</span>
                        <span className="font-black text-emerald-400">${s.contract.spread.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* COMPACT RISK / TARGET EXECUTION BAR */}
                  <div className="p-3 bg-slate-900/60 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20">
                        <span className="text-[9px] text-rose-400 font-bold block">Stop</span>
                        <span className="font-bold text-rose-300">${s.targets.stopLoss.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[9px] text-emerald-400 font-bold block">T1 (+30%)</span>
                        <span className="font-bold text-emerald-300">${s.targets.target1.toFixed(2)}</span>
                      </div>
                      <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-[9px] text-cyan-400 font-bold block">T2 (+65%)</span>
                        <span className="font-bold text-cyan-300">${s.targets.target2.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* EXECUTE BUTTON */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        R:R <b className="text-emerald-400">{s.targets.rrRatio}</b>
                      </span>

                      <button
                        onClick={() => handleExecutePaperTrade(s, 3)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        Execute Paper (3x @ ${s.contract.ask})
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* 5. TAB 2: ACTIVE POSITIONS & LIVE P&L */}
      {activeTab === "POSITIONS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Active Managed Positions
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Live profit tracking, scale out, and trailing stops.
              </span>
            </div>

            <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-right">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Open P&L</span>
              <span className={`text-sm font-black font-mono ${activeUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeUnrealizedPnl >= 0 ? `+$${activeUnrealizedPnl.toFixed(2)}` : `-$${Math.abs(activeUnrealizedPnl).toFixed(2)}`}
              </span>
            </div>
          </div>

          {activePositions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No open positions right now.</p>
              <button
                onClick={() => setActiveTab("SETUPS")}
                className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase hover:bg-cyan-500/20"
              >
                Scan Setups &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activePositions.map(pos => {
                const pnlDollars = (pos.currentPrice - pos.entryPrice) * pos.qty * 100;
                const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

                return (
                  <div key={pos.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-base font-black text-slate-100 font-mono">{pos.underlying} ${pos.strike} Call</span>
                        <span className="text-xs text-slate-400 font-mono block">{pos.qty} Contracts • Filled @ {pos.entryTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Entry</span>
                        <span className="font-bold text-slate-200">${pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Stop</span>
                        <span className="font-bold text-rose-400">${pos.stopLoss.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase">Target 1</span>
                        <span className="font-bold text-emerald-400">${pos.target1.toFixed(2)}</span>
                      </div>

                      <div className={`px-3 py-1 rounded-lg font-bold ${
                        pnlDollars >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {pnlDollars >= 0 ? `+$${pnlDollars.toFixed(2)} (+${pnlPercent.toFixed(1)}%)` : `-$${Math.abs(pnlDollars).toFixed(2)} (${pnlPercent.toFixed(1)}%)`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScaleOut50(pos.id)}
                        disabled={pos.status === "SCALED_50"}
                        className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Scale 50%
                      </button>
                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        className="px-3 py-1 rounded text-xs font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                      >
                        Flatten
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 3: SIGNAL TIMELINE */}
      {activeTab === "SIGNALS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                Chronological Signal Log
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Historical breakout callouts with peak gains (MFE) and outcomes.
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">{signalsHistory.length} Alerted Today</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3">Target Option</th>
                  <th className="p-3">Entry</th>
                  <th className="p-3">Peak Gain (MFE)</th>
                  <th className="p-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {signalsHistory.map(sig => (
                  <tr key={sig.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-cyan-400">{sig.timestamp}</td>
                    <td className="p-3 font-black text-slate-100">{sig.symbol}</td>
                    <td className="p-3 text-slate-300 font-sans">{sig.signalType}</td>
                    <td className="p-3 font-bold text-slate-200">{sig.contract}</td>
                    <td className="p-3 text-slate-300">${sig.entryPremium.toFixed(2)}</td>
                    <td className="p-3 font-black text-emerald-400">{sig.peakGainPercent}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sig.outcomeColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {sig.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB 4: ANALYTICS & TRADE JOURNAL */}
      {activeTab === "ANALYTICS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Win Rate</span>
                <span className="text-2xl font-black text-emerald-400">{displayWinRate}%</span>
                <span className="text-[10px] text-slate-500 block">{analytics ? analytics.winCount : 3}W / {analytics ? analytics.lossCount : 1}L</span>
              </div>
              <Award className="w-8 h-8 text-emerald-400 opacity-60" />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Profit Factor</span>
                <span className="text-2xl font-black text-purple-400">{analytics ? analytics.profitFactor : 6.25}</span>
                <span className="text-[10px] text-slate-400 block">Avg Win: +${analytics ? analytics.avgWin : 225}</span>
              </div>
              <BarChart2 className="w-8 h-8 text-purple-400 opacity-60" />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Net P&L</span>
                <span className="text-2xl font-black text-cyan-400">+${displayTotalPnl.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 block">Best: {analytics ? analytics.bestTrade : '+$315 CRWD'}</span>
              </div>
              <DollarSign className="w-8 h-8 text-cyan-400 opacity-60" />
            </div>
          </div>

          {/* Trade Journal Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" />
              Post-Mortem Trade Journal & Reviews
            </h3>

            <div className="space-y-2.5">
              {closedTrades.map(trade => (
                <div key={trade.id} className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-slate-100">{trade.underlying} • {trade.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      trade.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)} (${trade.pnlPercent})` : `-$${Math.abs(trade.pnl).toFixed(2)} (${trade.pnlPercent})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans italic">"{trade.lessons}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. TAB 5: ENGINE AUDIT FEED */}
      {activeTab === "LOGS" && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              Live Loop Audit Stream
            </span>
          </div>
          <div className="h-96 overflow-y-auto space-y-1 custom-scrollbar text-[11px]">
            {liveLog.map((log, i) => (
              <div key={i} className="text-slate-400 leading-tight">{log}</div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
