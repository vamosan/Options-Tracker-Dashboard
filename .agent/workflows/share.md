---
description: How to share your Options Tracker with friends globally
---

## Option 1: Quick Sharing (Tunneling)
This method allows you to share your **currently running** local server without any deployment.

1.  Keep your `npm run dev` terminal running.
2.  Open a **new** terminal.
3.  Run the following command to create a public link:
    ```bash
    npx localtunnel --port 3000
    ```
4.  Copy the URL provided (e.g., `https://options-tracker-xxxx.loca.lt`).
5.  Share this link with your friends.
    > [!NOTE]
    > Friends will need to enter your public IP address once (a security step from Localtunnel) to see the site. You can find your IP at [whatsmyip.org](https://whatsmyip.org).

## Option 2: Permanent Deployment (Vercel)
This makes your website available 24/7 on a `vercel.app` domain.

1.  Install the Vercel CLI:
    ```bash
    npm install -g vercel
    ```
2.  Log in to Vercel:
    ```bash
    vercel login
    ```
3.  Run the deployment command:
    ```bash
    vercel
    ```
4.  Follow the prompts (defaults are usually fine).
5.  Once finished, you will get a permanent URL to share.

> [!IMPORTANT]
> Since this app uses server-side JSON files, data saved on Vercel's serverless environment might reset after some time or across different instances. For permanent storage in a deployed environment, we can help you integrate a database (like Supabase or MongoDB) later if needed.
