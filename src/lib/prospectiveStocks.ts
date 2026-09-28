export interface ProspectiveStock {
  symbol: string;
  name: string;
  sector: "AI & Semi" | "Cybersecurity" | "Cloud & Big Tech" | "Healthcare" | "High-Beta & Crypto";
  marketCap: string;
  price: number;
  changePercent: number;
  probabilityScore: number;
  probabilityRating: "95% ELITE" | "94% ELITE" | "92% ELITE" | "91% HIGH" | "90% HIGH" | "88% HIGH";
  catalystHeadline: string;
  eventType: "SEC 8-K / Capex Beat" | "Product Launch" | "Federal DoD Contract" | "Guidance & Margin Expansion" | "FDA / Medicare Expansion" | "Strategic Breakout";
  newsDetails: string;
  triggerShelf: string;
  invalidationLevel: string;
  suggestedOption: {
    contract: string;
    strike: number;
    type: "CALL";
    expiry: string;
    estimatedAsk: number;
    target1: number;
    target2: number;
    stopLoss: number;
  };
  gatekeeperStatus: {
    status: "READY" | "DEFENSIVE_MIDDAY" | "PENDING_0935";
    badge: string;
    rulesMessage: string;
    rvolExpectation: string;
  };
  tags: string[];
}

export interface MarketOutlookData {
  date: string;
  tapeBias: {
    spyTrend: string;
    qqqTrend: string;
    overall: "BULLISH RISK-ON" | "NEUTRAL ACCUMULATION" | "DEFENSIVE ROTATION";
    vixValue: number;
    vixInterpretation: string;
    tenYearYield: string;
  };
  todayEvents: Array<{
    time: string;
    event: string;
    impact: "HIGH" | "MEDIUM" | "FED";
    consensus: string;
  }>;
  executiveSummary: string;
  gameplanDirectives: string[];
}

export const CURRENT_MARKET_OUTLOOK: MarketOutlookData = {
  date: "Today's Session",
  tapeBias: {
    spyTrend: "Holding above 20-day EMA $564.80 (Targeting $575 ATH Extension)",
    qqqTrend: "AI Cloud & Semi Momentum Above $485.50 Shelf (RSI 61)",
    overall: "BULLISH RISK-ON",
    vixValue: 15.2,
    vixInterpretation: "Low-Vol Grind (<16.0) • Favors Clean Directional Breakouts • Low Whipsaw Risk",
    tenYearYield: "3.75% (Accommodative for Tech & Growth Multiple Expansion)",
  },
  todayEvents: [
    {
      time: "08:30 AM ET",
      event: "Core PCE Price Index & Personal Spending",
      impact: "HIGH",
      consensus: "+0.2% MoM / +2.6% YoY (Inline)",
    },
    {
      time: "10:00 AM ET",
      event: "ISM Manufacturing PMI & New Orders Index",
      impact: "HIGH",
      consensus: "49.2 Expected",
    },
    {
      time: "01:00 PM ET",
      event: "US Treasury 10-Year Note Auction",
      impact: "MEDIUM",
      consensus: "Strong Institutional Indirect Bidding",
    },
    {
      time: "02:00 PM ET",
      event: "Fed Vice Chair Financial Stability Remarks",
      impact: "FED",
      consensus: "Neutral / Rate-Cut Path Validation",
    },
  ],
  executiveSummary:
    "Institutional flows remain aggressively weighted into Tech, Cloud AI infrastructure, and high-margin healthcare turnarounds. Cleanest breakout setups occur between 09:35–10:00 AM ET for Tech/Semis, and 10:15–11:30 AM ET for defensive consolidation shelf breaks.",
  gameplanDirectives: [
    "Tech & Semis (NVDA, META, AMD, PLTR): Green flag on 09:35 AM candle close with RVOL >= 2.8x.",
    "Defensive Quarantine (CVS): Strictly quarantine prior to 10:15 AM ET. Execute only upon Midday box breakout with RVOL >= 3.0x (100% win rate track record).",
    "Cybersecurity (CRWD, PANW): Wait for confirmed 5-minute candle close at 09:35:01 to eliminate opening wick traps.",
  ],
};

export const PROSPECTIVE_STOCKS: ProspectiveStock[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    sector: "AI & Semi",
    marketCap: "$3,020B",
    price: 224.50,
    changePercent: +2.85,
    probabilityScore: 95,
    probabilityRating: "95% ELITE",
    catalystHeadline: "Blackwell Ultra GB200 Volume Shipments Accelerated; Hyperscaler 2026 Capex Raised +$32B",
    eventType: "SEC 8-K / Capex Beat",
    newsDetails:
      "Tier-1 Cloud Hyperscalers (MSFT, META, AMZN) raised aggregate 2026 AI compute capex by +$32B. Supply chain checks confirm GB200 NVL72 rack-scale systems shipping ahead of schedule with 100% pre-booked production.",
    triggerShelf: "Breakout above $226.50 ORB High • Midday support shelf at $223.80",
    invalidationLevel: "$222.10 (5-min ORB Low)",
    suggestedOption: {
      contract: "NVDA $230C",
      strike: 230,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 2.45,
      target1: 3.20,
      target2: 4.05,
      stopLoss: 1.85,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "Tech Momentum Tier • Projected RVOL 3.4x > 2.8x floor • Bullish body structure.",
      rvolExpectation: "3.4x Institutional Vol",
    },
    tags: ["#BlackwellRamp", "#HyperscalerCapex", "#Tier1Momentum"],
  },
  {
    symbol: "CVS",
    name: "CVS Health Corp.",
    sector: "Healthcare",
    marketCap: "$73.5B",
    price: 85.65,
    changePercent: +4.20,
    probabilityScore: 92,
    probabilityRating: "92% ELITE",
    catalystHeadline: "Pharmacy Services Margin Beat + CMS Star Ratings Settlement Reversal",
    eventType: "Guidance & Margin Expansion",
    newsDetails:
      "Pharmacy Services operating margins beat consensus by 140 bps. CMS Medicare Star ratings appeal settlement restores bonus payments, adding projected $1.2B in 2026 adjusted operating cash flow.",
    triggerShelf: "Midday Horizontal Box Breakout > $85.60 Shelf (Confirmed after 10:15 AM ET)",
    invalidationLevel: "$84.70 (Midday VWAP Shelf)",
    suggestedOption: {
      contract: "CVS $86C",
      strike: 86,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 1.35,
      target1: 1.75,
      target2: 2.45,
      stopLoss: 1.01,
    },
    gatekeeperStatus: {
      status: "DEFENSIVE_MIDDAY",
      badge: "MIDDAY BREAKOUT RULE",
      rulesMessage: "Defensive stock quarantine: Blocked <10:15 AM. 100% win rate when taken on midday breakout with RVOL >= 3.0x.",
      rvolExpectation: "3.2x Tape Surge",
    },
    tags: ["#MarginTurnaround", "#MiddayBoxBreak", "#100PercentWinRate"],
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    sector: "Cloud & Big Tech",
    marketCap: "$1,440B",
    price: 755.00,
    changePercent: +3.15,
    probabilityScore: 94,
    probabilityRating: "94% ELITE",
    catalystHeadline: "Llama 4 Open Multi-Modal Release + AI Ad Monetization ROAS Surge",
    eventType: "Product Launch",
    newsDetails:
      "Llama 4 foundation model demonstrates 40% inference latency reduction on custom silicon. Automated Advantage+ AI campaigns driving 28% higher advertiser ROAS across Instagram Reels.",
    triggerShelf: "Breakout above $758.00 morning resistance shelf • VWAP support $751.20",
    invalidationLevel: "$748.00 (Structural Swing Low)",
    suggestedOption: {
      contract: "META $760C",
      strike: 760,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 3.10,
      target1: 4.05,
      target2: 5.10,
      stopLoss: 2.30,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "Tech Momentum Tier • Projected RVOL 3.1x • Confirmed positive volume delta.",
      rvolExpectation: "3.1x Institutional Vol",
    },
    tags: ["#Llama4Launch", "#AIAdExpansion", "#MegaCapTrend"],
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    sector: "AI & Semi",
    marketCap: "$380B",
    price: 161.20,
    changePercent: +2.40,
    probabilityScore: 91,
    probabilityRating: "91% HIGH",
    catalystHeadline: "Instinct MI350 Cloud Cluster Deployment by Tier-1 Hyperscalers",
    eventType: "Strategic Breakout",
    newsDetails:
      "Tier-1 cloud hyperscalers announce production rollout of AMD Instinct MI350 GPU clusters with ROCm 6.2 ecosystem parity, capturing enterprise LLM inference workloads at 25% lower TCO.",
    triggerShelf: "Breakout above $162.80 resistance shelf • Dynamic support at $159.40",
    invalidationLevel: "$158.00 (Morning ORB Low)",
    suggestedOption: {
      contract: "AMD $165C",
      strike: 165,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 2.15,
      target1: 2.80,
      target2: 3.55,
      stopLoss: 1.60,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "High-Beta Semi Tier • Target RVOL >= 2.8x • Bullish momentum candle close.",
      rvolExpectation: "2.9x Institutional Vol",
    },
    tags: ["#InstinctMI350", "#SemiMomentum", "#CloudHyperscale"],
  },
  {
    symbol: "CRWD",
    name: "CrowdStrike Holdings",
    sector: "Cybersecurity",
    marketCap: "$66.8B",
    price: 255.00,
    changePercent: +1.95,
    probabilityScore: 88,
    probabilityRating: "88% HIGH",
    catalystHeadline: "Falcon Identity & Next-Gen SIEM Attain DoD FedRAMP High Authorization",
    eventType: "Federal DoD Contract",
    newsDetails:
      "Department of Defense authorizes Falcon platform across classified federal networks. Platformization net retention rate increases to 118% as multi-module enterprise adoptions hit new records.",
    triggerShelf: "Wait for 09:35 AM candle close confirmation; breakout above $258.50 shelf",
    invalidationLevel: "$252.80 (Avoid 09:32 AM Wick Traps)",
    suggestedOption: {
      contract: "CRWD $260C",
      strike: 260,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 2.30,
      target1: 3.00,
      target2: 3.80,
      stopLoss: 1.72,
    },
    gatekeeperStatus: {
      status: "PENDING_0935",
      badge: "AWAITING 09:35 CANDLE CLOSE",
      rulesMessage: "Must confirm full 5-minute candle close at 09:35:01 AM and RVOL >= 2.8x to prevent false opening wick trap.",
      rvolExpectation: "2.8x Confirmation Floor",
    },
    tags: ["#FedRAMPHigh", "#DoDContract", "#Wait0935Close"],
  },
  {
    symbol: "PLTR",
    name: "Palantir Technologies",
    sector: "High-Beta & Crypto",
    marketCap: "$84.0B",
    price: 37.60,
    changePercent: +3.80,
    probabilityScore: 92,
    probabilityRating: "92% ELITE",
    catalystHeadline: "Commercial AIP Bootcamps Deliver 85% Conversion + US SOCOM $178M Contract",
    eventType: "Federal DoD Contract",
    newsDetails:
      "Commercial AIP customer conversion climbs to 85% within 30 days of bootcamp completion. US Special Operations Command extends tactical enterprise AI mandate with $178M commitment.",
    triggerShelf: "Breakout above $38.20 resistance shelf • Momentum support at $37.30",
    invalidationLevel: "$36.90 (VWAP Floor)",
    suggestedOption: {
      contract: "PLTR $38.5C",
      strike: 38.5,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 1.15,
      target1: 1.50,
      target2: 1.90,
      stopLoss: 0.85,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "High-Momentum Growth Tier • Projected RVOL 3.6x • Bullish order book delta.",
      rvolExpectation: "3.6x Tape Surge",
    },
    tags: ["#AIPBootcamp", "#DoDDefense", "#MomentumBreakout"],
  },
  {
    symbol: "LLY",
    name: "Eli Lilly & Co.",
    sector: "Healthcare",
    marketCap: "$875B",
    price: 924.50,
    changePercent: +2.10,
    probabilityScore: 90,
    probabilityRating: "90% HIGH",
    catalystHeadline: "$5.3B Manufacturing Facility Online + Medicare Part D Incretin Coverage",
    eventType: "FDA / Medicare Expansion",
    newsDetails:
      "FDA fast-tracks clearance for multi-facility incretin peptide manufacturing expansion. CMS expands Medicare Part D coverage for metabolic cardiovascular indications, unlocking an estimated 14M eligible patients.",
    triggerShelf: "Breakout above $930.00 shelf • Pullback support at $920.00",
    invalidationLevel: "$914.00 (Key Swing Pivot)",
    suggestedOption: {
      contract: "LLY $935C",
      strike: 935,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 3.40,
      target1: 4.40,
      target2: 5.60,
      stopLoss: 2.55,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "Healthcare Mega-Cap Tier • Institutional block flow positive • RVOL 2.9x.",
      rvolExpectation: "2.9x Institutional Vol",
    },
    tags: ["#MedicareExpansion", "#IncretinRamp", "#MegaCapHealthcare"],
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    sector: "High-Beta & Crypto",
    marketCap: "$810B",
    price: 375.00,
    changePercent: +3.20,
    probabilityScore: 89,
    probabilityRating: "89% HIGH",
    catalystHeadline: "FSD V13 Unsupervised Fleet Safety Data + Megapack Revenue +62% YoY",
    eventType: "Product Launch",
    newsDetails:
      "FSD V13 commercial autonomous fleet logs 50M miles with 5x human driver intervention reduction. Energy Storage revenue beats estimates by 18%, accelerating gross margin recovery.",
    triggerShelf: "Breakout above $380.00 shelf • Dynamic VWAP support at $372.50",
    invalidationLevel: "$368.00 (Opening Range Low)",
    suggestedOption: {
      contract: "TSLA $385C",
      strike: 385,
      type: "CALL",
      expiry: "Weekly",
      estimatedAsk: 3.60,
      target1: 4.70,
      target2: 5.95,
      stopLoss: 2.70,
    },
    gatekeeperStatus: {
      status: "READY",
      badge: "GATEKEEPER QUALIFIED",
      rulesMessage: "High-Beta Volatility Tier • Strict stop loss discipline required • RVOL 3.2x.",
      rvolExpectation: "3.2x Tape Velocity",
    },
    tags: ["#FSDv13", "#MegapackSurge", "#HighBetaRunner"],
  },
];
