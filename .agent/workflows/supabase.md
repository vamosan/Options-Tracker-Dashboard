---
description: How to set up your Supabase database for the Options Tracker
---

## 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Note your **Project URL** and **API Key** (Service Role Key) for later.

## 2. Initialize the Database Schema
Go to the **SQL Editor** in your Supabase dashboard and run the following script:

```sql
-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trades table (covers both open positions and history)
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Call' | 'Put'
    strike DECIMAL NOT NULL,
    expiration DATE NOT NULL,
    premium DECIMAL NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
    entry_date DATE NOT NULL,
    entry_time TEXT NOT NULL,
    exit_price DECIMAL,
    exit_date TIMESTAMP WITH TIME ZONE,
    realized_pl DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) is recommended for production, 
-- but for this quick setup we will use the Service Role Key for now.
```

## 3. Configure Environment Variables
Create or update your `.env.local` file with the following keys from your Supabase dashboard (**Settings > API**):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key
POLYGON_API_KEY=your_polygon_key
```
