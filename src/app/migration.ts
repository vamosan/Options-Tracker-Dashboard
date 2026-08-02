"use server";

import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";
import { Position } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

/**
 * Migration Script: JSON -> Supabase
 * Use this to move all local trade data to the cloud.
 */
export async function migrateToSupabase() {
    console.log("Starting cloud migration...");

    if (!fs.existsSync(USERS_DIR)) {
        return { success: false, message: "No local user data found to migrate." };
    }

    const profiles = fs.readdirSync(USERS_DIR);
    let migratedCount = 0;

    for (const username of profiles) {
        const userDir = path.join(USERS_DIR, username);
        if (!fs.statSync(userDir).isDirectory()) continue;

        const posFile = path.join(userDir, "positions.json");
        const histFile = path.join(userDir, "history.json");

        // 1. Create Profile in Supabase
        const { data: profile, error: pError } = await supabase
            .from("profiles")
            .upsert({ username: username.toLowerCase() }, { onConflict: "username" })
            .select()
            .single();

        if (pError) {
            console.error(`Error creating profile for ${username}:`, pError);
            continue;
        }

        // 2. Migrate Positions
        if (fs.existsSync(posFile)) {
            const positions: Position[] = JSON.parse(fs.readFileSync(posFile, "utf-8") || "[]");
            for (const pos of positions) {
                const { error: tError } = await supabase.from("trades").upsert({
                    id: pos.id,
                    profile_id: profile.id,
                    symbol: pos.symbol,
                    type: pos.type,
                    strike: pos.strike,
                    expiration: pos.expiration,
                    premium: pos.premium,
                    quantity: pos.quantity,
                    notes: pos.notes || "",
                    status: "OPEN",
                    entry_date: pos.entryDate,
                    entry_time: pos.entryTime,
                    created_at: new Date(pos.entryDate || Date.now()).toISOString()
                });
                if (tError) console.error(`Error migrating position ${pos.id}:`, tError);
                else migratedCount++;
            }
        }

        // 3. Migrate History
        if (fs.existsSync(histFile)) {
            const history: Position[] = JSON.parse(fs.readFileSync(histFile, "utf-8") || "[]");
            for (const pos of history) {
                const { error: tError } = await supabase.from("trades").upsert({
                    id: pos.id,
                    profile_id: profile.id,
                    symbol: pos.symbol,
                    type: pos.type,
                    strike: pos.strike,
                    expiration: pos.expiration,
                    premium: pos.premium,
                    quantity: pos.quantity,
                    notes: pos.notes || "",
                    status: "CLOSED",
                    entry_date: pos.entryDate,
                    entry_time: pos.entryTime,
                    exit_price: pos.exitPrice,
                    realized_pl: pos.realizedPl,
                    created_at: new Date(pos.entryDate || Date.now()).toISOString()
                });
                if (tError) console.error(`Error migrating history ${pos.id}:`, tError);
                else migratedCount++;
            }
        }
    }

    return { success: true, message: `Successfully migrated ${migratedCount} trades across ${profiles.length} profiles.` };
}
