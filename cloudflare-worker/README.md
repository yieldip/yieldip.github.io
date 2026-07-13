# Contact form spam protection — setup

This Worker sits between the contact form on yieldip.com and Google Forms.
It verifies a Cloudflare Turnstile token server-side before forwarding the
submission, so the real Google Forms URL is never exposed to bots.

## One-time setup

### 1. Create a Turnstile widget
1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Turnstile** (sign up free if you don't have an account)
2. Click **Add site**
3. Domain: `yieldip.com`
4. Widget mode: **Managed** (recommended — shows a checkbox only when suspicious)
5. Save. You'll get a **Site Key** (public) and a **Secret Key** (private — never put this in the HTML/repo)

### 2. Install Wrangler (Cloudflare's CLI) and log in
```bash
npm install -g wrangler
wrangler login
```
This opens a browser to authorize Wrangler against your Cloudflare account.

### 3. Deploy the Worker
```bash
cd cloudflare-worker
wrangler deploy
```
This prints your Worker's URL, e.g. `https://yieldip-contact-proxy.<your-subdomain>.workers.dev`

### 4. Set the Turnstile secret key on the Worker
```bash
wrangler secret put TURNSTILE_SECRET_KEY
```
Paste the **Secret Key** from step 1 when prompted. It's stored encrypted on Cloudflare, never in this repo.

### 5. Wire up index.html
In `/index.html`, replace:
- `YOUR_TURNSTILE_SITE_KEY` with the **Site Key** from step 1
- `YOUR_WORKER_URL` with the Worker URL from step 3

## Verifying it works
1. Open yieldip.com, fill and submit the contact form — Turnstile should show briefly (or pass invisibly), then the success snackbar should appear
2. Check the Google Sheet linked to the form — the response should land there
3. Try POSTing directly to the Worker URL without a valid token (e.g. via curl) — should get a 400/403, and nothing should reach the Google Sheet
