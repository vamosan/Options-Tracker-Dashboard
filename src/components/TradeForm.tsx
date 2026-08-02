"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./ui/card";
import { Trade, OptionType } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface TradeFormProps {
    onAddTrade: (trade: Trade) => void;
}

export function TradeForm({ onAddTrade }: TradeFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [symbol, setSymbol] = useState("");
    const [type, setType] = useState<OptionType>("Call");
    const [strike, setStrike] = useState("");
    const [expiration, setExpiration] = useState("");
    const [entryTime, setEntryTime] = useState(() => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    });
    const [premium, setPremium] = useState("");
    const [quantity, setQuantity] = useState("1");
    const [notes, setNotes] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol || !strike || !expiration || !premium || !quantity) return;

        const newTrade: Trade = {
            id: uuidv4(),
            symbol: symbol.toUpperCase(),
            type,
            strike: parseFloat(strike),
            expiration,
            premium: parseFloat(premium),
            quantity: parseInt(quantity),
            entryDate: new Date().toISOString(),
            entryTime: entryTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), // Default to current time if empty
            notes: notes.trim(),
        };

        onAddTrade(newTrade);
        setSymbol("");
        setStrike("");
        setPremium("");
        setEntryTime("");
        setQuantity("1");
        setNotes("");
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-cyan-500/20 transition-all duration-300 transform hover:scale-105"
            >
                <Plus className="mr-2 h-5 w-5" /> Add New Trade
            </Button>
        );
    }

    return (
        <Card className="w-full animate-in fade-in zoom-in-95 duration-300 border-cyan-500/30 shadow-2xl shadow-cyan-900/20">
            <CardHeader className="relative pb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-4 text-slate-400 hover:text-white hover:bg-white/10"
                    onClick={() => setIsOpen(false)}
                >
                    <X className="h-4 w-4" />
                </Button>
                <CardTitle className="text-xl text-cyan-400">New Option Trade</CardTitle>
                <CardDescription className="text-slate-400">Enter trade details to track performance.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2 md:col-span-1">
                            <Label htmlFor="symbol" className="text-slate-300">Symbol</Label>
                            <Input
                                id="symbol"
                                placeholder="SPY"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="uppercase tracking-wide font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-slate-300">Type</Label>
                            <div className="flex space-x-2">
                                <Button
                                    type="button"
                                    variant={type === "Call" ? "default" : "outline"}
                                    className={`w-full ${type === "Call" ? "bg-green-600/80 hover:bg-green-600 border-green-500" : "border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800"}`}
                                    onClick={() => setType("Call")}
                                >
                                    Call
                                </Button>
                                <Button
                                    type="button"
                                    variant={type === "Put" ? "default" : "outline"}
                                    className={`w-full ${type === "Put" ? "bg-red-600/80 hover:bg-red-600 border-red-500" : "border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800"}`}
                                    onClick={() => setType("Put")}
                                >
                                    Put
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="strike" className="text-slate-300">Strike Price</Label>
                            <Input
                                id="strike"
                                type="number"
                                step="0.01"
                                placeholder="500.00"
                                value={strike}
                                onChange={(e) => setStrike(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expiration" className="text-slate-300">Expiration</Label>
                            <Input
                                id="expiration"
                                type="date"
                                value={expiration}
                                onChange={(e) => setExpiration(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="entryTime" className="text-slate-300">Time of Buy</Label>
                            <Input
                                id="entryTime"
                                type="time"
                                value={entryTime}
                                onChange={(e) => setEntryTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="premium" className="text-slate-300">Premium (Cost)</Label>
                            <Input
                                id="premium"
                                type="number"
                                step="0.01"
                                placeholder="5.40"
                                value={premium}
                                onChange={(e) => setPremium(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="quantity" className="text-slate-300">Quantity</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-slate-300">Notes (Optional)</Label>
                        <Input
                            id="notes"
                            placeholder="Thesis, setup details, etc."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold mt-4 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                        Add Trade
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
