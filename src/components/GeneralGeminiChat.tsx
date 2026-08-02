"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Sparkles, Loader2, Bot } from "lucide-react";
import { chatWithGeminiGeneral } from "@/app/actions";

interface GeneralGeminiChatProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GeneralGeminiChat({ isOpen, onClose }: GeneralGeminiChatProps) {
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial greeting if history is empty
    useEffect(() => {
        if (isOpen && chatHistory.length === 0) {
            setChatHistory([
                { role: 'model', parts: [{ text: "Hello! I am Gemini, your AI trading assistant. Ask me about the markets, options strategies, or general trading concepts." }] }
            ]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatHistory, isOpen]);

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isLoading) return;

        const userMsg = chatInput;
        setChatInput("");
        const newHistory = [...chatHistory, { role: 'user' as const, parts: [{ text: userMsg }] }];
        setChatHistory(newHistory);
        setIsLoading(true);

        try {
            const response = await chatWithGeminiGeneral(chatHistory, userMsg);
            if (response.includes("trouble processing")) {
                setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: "❌ Gemini API Error: " + response }] }]);
            } else {
                setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: response }] }]);
            }
        } catch (error: any) {
            console.error("Chat failed:", error);
            setChatHistory([...newHistory, { role: 'model' as const, parts: [{ text: "⚠️ Connectivity Error: " + (error.message || "Unable to reach AI services.") }] }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <React.Fragment>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] shadow-[-10px_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col transform transition-transform duration-500 ease-out bg-slate-900 border-l border-slate-700/50">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30">
                            <Bot className="h-5 w-5 text-indigo-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight">Gemini Assistant</h2>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Market Intelligence</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${msg.role === 'user'
                                    ? 'bg-indigo-600/90 text-white rounded-tr-none'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                                }`}>
                                {msg.role === 'model' && (
                                    <div className="flex items-center gap-1.5 mb-2 border-b border-slate-700/50 pb-1.5">
                                        <Sparkles className="h-3 w-3 text-indigo-400" />
                                        <span className="text-[10px] text-indigo-400 uppercase font-black tracking-widest">Gemini</span>
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap">{msg.parts[0].text}</div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 shadow-lg max-w-[85%]">
                                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                                <span className="text-sm text-slate-400 animate-pulse">Gemini is thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-800/80 border-t border-slate-700/50 backdrop-blur">
                    <form onSubmit={handleChat} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask about markets, options strategies..."
                            disabled={isLoading}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isLoading}
                            className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-all shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:shadow-none transform active:scale-95 cursor-pointer"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </button>
                    </form>
                </div>
            </div>
        </React.Fragment>
    );
}
