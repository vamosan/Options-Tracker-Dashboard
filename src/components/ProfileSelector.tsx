"use client";

import React, { useState, useEffect } from "react";
import { User, Users, Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { listProfiles } from "@/app/actions";

interface ProfileSelectorProps {
    currentUser: string;
    onUserChange: (username: string) => void;
}

export function ProfileSelector({ currentUser, onUserChange }: ProfileSelectorProps) {
    const [profiles, setProfiles] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newUserName, setNewUserName] = useState("");

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        const list = await listProfiles();
        setProfiles(list);
    };

    const handleCreateProfile = () => {
        if (!newUserName.trim()) return;
        const name = newUserName.trim().toLowerCase();
        onUserChange(name);
        setNewUserName("");
        setIsAdding(false);
        loadProfiles();
    };

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-slate-900 border-slate-800 text-slate-300 hover:text-cyan-400 gap-2">
                        <User className="h-4 w-4" />
                        <span className="capitalize">{currentUser || "Select Profile"}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-300">
                    <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-widest">Switch Profile</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {profiles.map((profile) => (
                        <DropdownMenuItem
                            key={profile}
                            onClick={() => onUserChange(profile)}
                            className="flex items-center justify-between capitalize cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                        >
                            {profile}
                            {currentUser === profile && <Check className="h-3 w-3 text-cyan-500" />}
                        </DropdownMenuItem>
                    ))}
                    {profiles.length === 0 && (
                        <div className="px-2 py-4 text-center text-xs text-slate-600">No profiles found</div>
                    )}
                    <DropdownMenuSeparator className="bg-slate-800" />
                    <DropdownMenuItem
                        onSelect={(e: Event) => {
                            e.preventDefault();
                            setIsAdding(true);
                        }}
                        className="text-cyan-400 focus:text-cyan-300 cursor-pointer"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New Profile
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {isAdding && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                    <Input
                        placeholder="Name..."
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="h-9 w-32 bg-slate-950 border-cyan-900 focus:border-cyan-500 text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
                    />
                    <Button size="sm" onClick={handleCreateProfile} className="bg-cyan-600 hover:bg-cyan-500 h-9">
                        Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-9 w-9 p-0">
                        <Check className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
