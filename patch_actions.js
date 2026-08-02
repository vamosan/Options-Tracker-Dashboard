const fs = require('fs');
const file = 'c:/Users/prave/.gemini/antigravity/scratch/options-tracker/src/app/actions.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove yahoo-finance2 import
content = content.replace('import yahooFinance from "yahoo-finance2";\n', '');

// 2. Revert the Vercel-specific DATA_DIR logic
const customDataLogic = `const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? "/tmp/data" : path.join(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

// Ensure base directories exist safely without throwing on read-only serverless filesystems
try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
} catch (e) {
    console.warn("Could not create local data director in this environment:", e);
}`;

const originalDataLogic = `const DATA_DIR = path.join(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

// Ensure base directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });`;

content = content.replace(customDataLogic, originalDataLogic);

// 3. Wipe the scanner functions located after fetchBreakingNews
const wipeIndex = content.indexOf('export async function fetchUnusualVolume()');
if (wipeIndex !== -1) {
    content = content.substring(0, wipeIndex);
}

fs.writeFileSync(file, content);
console.log("Successfully patched actions.ts");
