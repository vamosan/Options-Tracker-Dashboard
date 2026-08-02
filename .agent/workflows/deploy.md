---
description: How to deploy your Options Tracker to Vercel
---

## 1. Install & Log In
1. Open your terminal.
2. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Log in:
   ```bash
   vercel login
   ```

## 2. Deploy & Link
Run the following command in your project root:
```bash
vercel
```
- Select "Yes" to set up and deploy.
- Choose your Vercel team (if applicable).
- Select "No" when asked if you want to link to an existing project.
- Name your project (e.g., `options-tracker`).
- Keep the default directory (./).
- Vercel will auto-detect Next.js. Select "No" if asked to override settings.

## 3. Add Environment Variables on Vercel
After the first deployment attempt (which may fail due to missing keys), go to your Vercel Dashboard (**Settings > Environment Variables**) and add:

- `NEXT_PUBLIC_SUPABASE_URL`: (From Supabase API settings)
- `SUPABASE_SERVICE_ROLE_KEY`: (From Supabase API settings)
- `POLYGON_API_KEY`: (Your Polygon.io API Key)

## 4. Final Deploy
Once keys are added, redeploy:
```bash
vercel --prod
```
Your site will be live at `https://options-tracker.vercel.app` (or similar).
