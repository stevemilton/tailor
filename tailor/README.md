# ✦ Tailor – AI Job Applications

Your CV, tailored perfectly. One click on any LinkedIn job.

## What it does

1. Reads your LinkedIn profile once as your master CV
2. You browse LinkedIn Jobs as normal
3. Click the Tailor extension on any job
4. It generates a tailored CV + cover letter in seconds
5. Auto-fills the Easy Apply form
6. Downloads as a file

## Setup (2 minutes)

### 1. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `tailor` folder
5. The Tailor icon appears in your toolbar

### 2. Get a LLM API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add a payment method
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-`)

### 3. First-time setup

1. Click the Tailor icon in Chrome
2. Paste your LinkedIn profile URL (e.g. `linkedin.com/in/yourname`)
3. Paste your LLM API key
4. Click **Get Started** — Tailor reads your profile automatically

### 4. Use it

1. Go to any LinkedIn job listing
2. Click the Tailor extension
3. Click **Tailor My Application**
4. Get your tailored CV + cover letter
5. Click **Auto-fill Easy Apply** or download the files

## Cost

Uses LLM API — roughly £0.02–0.05 per application.

## Icons

The `icons/` folder needs PNG icons at 16px, 48px, and 128px.
You can use any needle/thread or scissors icon, or generate one.
For testing, Chrome will use a default icon if these are missing.

## Troubleshooting

**"Could not read profile"** — Make sure you're logged into LinkedIn in Chrome before setup.

**"No job detected"** — Make sure the URL contains `/jobs/view/` (click into the full job listing, not just hover).

**Auto-fill not working** — Click Easy Apply first to open the form, then click the Tailor button again.
