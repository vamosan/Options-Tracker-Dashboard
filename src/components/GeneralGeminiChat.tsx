"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, ShieldCheck, Zap, AlertTriangle, HelpCircle } from "lucide-react";
import { chatWithGeminiGeneral } from "@/app/actions";

interface GeneralGeminiChatProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrompt?: string;
    onClearInitialPrompt?: () => void;
}

export function GeneralGeminiChat({ isOpen, onClose, initialPrompt, onClearInitialPrompt }: GeneralGeminiChatProps) {
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasHandledInitial = useRef(false);

    // Initial greeting if history is empty
    useEffect(() => {
        if (isOpen && chatHistory.length === 0) {
            setChatHistory([
                {
                    role: 'model',
                    parts: [{
                        text: "🛡️ **Gatekeeper AI Copilot Online**\n\nI am wired directly into live market prices, true intraday VWAP, and institutional Anti-Chase rules.\n\nBefore you click 'Buy' on any trade, ask me:\n• *\"Should I buy SPY 773 Calls right now?\"*\n• *\"Where is the support floor on SPY?\"*\n• *\"$200 Challenge: What is the safest trade right now?\"*\n\nI will audit extension, calculate your hard -25% stop loss, and tell you bluntly whether to enter or sit on hands."
                    }]
                }
            ]);
        }
    }, [isOpen]);

    // Handle initial prompt from outside (e.g. clicking "Audit Trade" button)
    useEffect(() => {
        if (isOpen && initialPrompt && !hasHandledInitial.current) {
            hasHandledInitial.current = true;
            submitMessage(initialPrompt);
            if (onClearInitialPrompt) onClearInitialPrompt();
        }
        if (!isOpen) {
            hasHandledInitial.current = false;
        }
    }, [isOpen, initialPrompt]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, isOpen]);

    const submitMessage = async (msgText: string) => {
        if (!msgText.trim() || isLoading) return;

        const newHistory = [...chatHistory, { role: 'user' as const, parts: [{ text: msgText }] }];
        setChatHistory(newHistory);
        setIsLoading(true);

        try {
            const response = await chatWithGeminiGeneral(chatHistory, msgText);
            setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: response }] }]);
        } catch (error: any) {
            console.error("Chat failed:", error);
            setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: "⚠️ Connectivity Notice: " + (error.message || "Unable to reach Gatekeeper services.") }] }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = chatInput;
        setChatInput("");
        await submitMessage(msg);
    };

    const quickChips = [
        { label: "⚡ Should I enter SPY Calls right now?", prompt: "Should I buy SPY Calls right now? Check current price vs VWAP, extension from session high, and tell me whether it's safe or extended." },
        { label: "📉 Should I enter QQQ Puts right now?", prompt: "Should I buy QQQ Puts right now? Check if QQQ is trading below VWAP and if it's safe to enter." },
        { label: "🛡️ What is today's SPY support & VWAP?", prompt: "Where are the key support levels, prior day close, and true VWAP for SPY right now?" },
        { label: "💰 $200 Challenge: Best safe setup?", prompt: "I am trading a $200 challenge account. What is the safest risk-controlled setup right now with a strict -25% stop loss and maximum 1 contract under $2.00 ask?" },
    ];

    if (!isOpen) return null;

    return (
        <React.Fragment>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] shadow-[-10px_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col transform transition-transform duration-500 ease-out bg-slate-950 border-l border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/40">
                            <Bot className="h-5 w-5 text-indigo-400 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 tracking-tight">
                                    Gatekeeper AI Copilot
                                </h2>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    LIVE TAPE
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black font-mono">
                                Real-Time Trade Timing &amp; Anti-Chase Auditor
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Close Copilot"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Sub-Banner Policy */}
                <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/40 flex items-center justify-between text-[11px] font-mono text-indigo-200">
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                        Anti-Chase Leash: ±0.45% • Hard Stop: -25%
                    </span>
                    <span className="text-slate-400">$200 Max Risk: $40</span>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/70 scrollbar-thin scrollbar-thumb-slate-800">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-lg ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none font-sans'
                                    : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none font-sans'
                                }`}>
                                {msg.role === 'model' && (
                                    <div className="flex items-center gap-1.5 mb-2 border-b border-slate-800 pb-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                        <span className="text-[10px] text-indigo-400 uppercase font-black font-mono tracking-widest">
                                            Gatekeeper Copilot
                                        </span>
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap">{msg.parts[0].text}</div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 shadow-lg max-w-[85%]">
                                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                                <span className="text-xs font-mono text-slate-400 animate-pulse">
                                    Auditing live tape, VWAP distance &amp; support levels...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Action Chips */}
                <div className="p-3 bg-slate-900/90 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1.5">
                        ⚡ Quick Audit Questions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {quickChips.map((chip, cIdx) => (
                            <button
                                key={cIdx}
                                type="button"
                                disabled={isLoading}
                                onClick={() => submitMessage(chip.prompt)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/50 text-[11px] font-mono text-slate-300 hover:text-white transition-all text-left cursor-pointer disabled:opacity-40"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 backdrop-blur">
                    <form onSubmit={handleChat} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="e.g. Should I buy SPY 773 calls right now?"
                            disabled={isLoading}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 disabled:opacity-50 font-sans"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isLoading}
                            className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:shadow-none transform active:scale-95 cursor-pointer"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                    </form>
                </div>
            </div>
        </React.Fragment>
    );
}
