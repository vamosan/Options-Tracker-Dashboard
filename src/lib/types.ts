export type OptionType = "Call" | "Put";

export interface Trade {
    id: string;
    symbol: string;
    type: OptionType;
    strike: number;
    expiration: string; // YYYY-MM-DD
    premium: number;
    quantity: number;
    entryDate: string; // ISO Date for sorting/records
    entryTime: string; // User input time (e.g. "09:30")
    notes?: string;
}

export interface MarketData {
    symbol: string;
    price: number;
    change: number;
}

export interface Position extends Trade {
    currentPrice: number; // Current market price of the option
    isManualOverride?: boolean; // Flag to prevent API overwriting user inputs
    pl: number; // Unrealized P&L
    marketValue: number;
    lastUpdated?: string;

    // For History
    status: 'OPEN' | 'CLOSED';
    exitPrice?: number;
    exitDate?: string;
    realizedPl?: number;

    // AI Intelligence
    recommendation?: {
        signal: string;
        color: string;
    };

    greeks?: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        iv: number;
    };
}
