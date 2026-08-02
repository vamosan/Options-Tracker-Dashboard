import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Minimize2, Maximize2 } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface ChatMessage {
    id: string;
    username: string;
    text: string;
    timestamp: string;
}

export function ChatBox() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [username, setUsername] = useState("Trader");
    const [socket, setSocket] = useState<Socket | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize Socket and sync username
    useEffect(() => {
        // Sync username from global profile state
        const savedUser = localStorage.getItem("options-username");
        if (savedUser) {
            setUsername(savedUser);
        }

        // Connect to custom server
        const newSocket = io(window.location.origin);
        setSocket(newSocket);

        newSocket.on("receive_message", (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Update username if it changes while chat is open
    useEffect(() => {
        const handleStorageChange = () => {
            const savedUser = localStorage.getItem("options-username");
            if (savedUser) setUsername(savedUser);
        };
        window.addEventListener("storage", handleStorageChange);
        // Rough custom event poll since localStorage event only fires across tabs
        const interval = setInterval(handleStorageChange, 2000);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen, isMinimized]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !socket) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            username,
            text: inputMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.emit("send_message", newMessage);
        setInputMessage("");
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all transform hover:scale-110 z-50 flex items-center justify-center animate-bounce-slow"
                aria-label="Open Chat"
            >
                <MessageSquare className="h-6 w-6" />
            </button>
        );
    }

    return (
        <div
            className={`fixed right-6 bottom-6 w-80 sm:w-96 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden z-50 transition-all duration-300 ease-in-out ${isMinimized ? "h-14" : "h-[500px] max-h-[80vh]"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <div className="flex items-center gap-2 text-white">
                    <MessageSquare className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-bold tracking-tight">Trader Lounge</h3>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    >
                        {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        className="p-1 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                                <MessageSquare className="h-8 w-8 opacity-20" />
                                <p className="text-sm">Welcome to the trading floor.</p>
                                <p className="text-xs">Say hello to other active traders!</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.username === username;
                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                        <span className="text-[10px] text-slate-500 font-mono mb-1 ml-1">
                                            {isMe ? "You" : msg.username} • {msg.timestamp}
                                        </span>
                                        <div
                                            className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe
                                                    ? "bg-cyan-600 text-white rounded-br-none"
                                                    : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-slate-800/80 border-t border-slate-700/50">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Share your trades..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim()}
                                className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors shrink-0"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
