# Financial Leak Detector

Static, client-side financial tools for analyzing:

- credit card debt payoff
- loan EMI and amortization
- subscription spending leaks

Live site: https://financial-leak-detector.pages.dev/

## Project Overview

This repository is a pure HTML/CSS/JavaScript project (no build step).
All calculations run in the browser; no user data is sent to a backend.

## Current Structure

```text
financial-leak-detector/
  index.html                     # Main debt analyzer page
  styles.css                     # Shared styling
  script.js                      # Main page form wiring
  calculations.js                # Core financial calculation functions
  insights.js                    # Insight generation rules
  ui.js                          # Shared UI rendering + Chart.js charts
  credit-card-leak/
    index.html
    cc-script.js
  emi-calculator/
    index.html
    emi-script.js
  subscription-leak/
    index.html
    sub-script.js
  README.md
  DOCUMENTATION.md
```

## Setup

### Prerequisites

- A modern browser
- Optional: Python (for a quick local static server)

### Run Locally

Option A: open `index.html` directly in a browser.

Option B (recommended): run a local static server.

```powershell
Set-Location "C:\Users\07kas\IdeaProjects\financial-leak-detector"
python -m http.server 8000
```

Then open:

- `http://localhost:8000/`

## Deployment

This repo is deployed as a static site on Cloudflare Pages.
Pushes to `main` trigger auto-deployment.

```powershell
Set-Location "C:\Users\07kas\IdeaProjects\financial-leak-detector"
git add .
git commit -m "your message"
git push origin main
```

## Search Console & SEO

The site now includes:

- `robots.txt`
- `sitemap.xml`
- canonical URLs on the main pages
- page-level social metadata and structured data

After deployment, submit the site to Google Search Console:

1. Open Google Search Console.
2. Add the property `https://financial-leak-detector.pages.dev/`.
3. Verify ownership using your preferred method (HTML tag, DNS, or provider-supported flow).
4. Submit the sitemap:

   - `https://financial-leak-detector.pages.dev/sitemap.xml`

5. Use URL Inspection to request indexing for:

   - `https://financial-leak-detector.pages.dev/`
   - `https://financial-leak-detector.pages.dev/credit-card-leak/`
   - `https://financial-leak-detector.pages.dev/emi-calculator/`
   - `https://financial-leak-detector.pages.dev/subscription-leak/`

Recommended monitoring inside Search Console:

- **Pages / Indexing**: confirm all pages are crawlable and indexed
- **Sitemaps**: confirm the sitemap is fetched successfully
- **Performance**: review impressions, queries, CTR, and top landing pages
- **Enhancements / Rich results**: validate structured data eligibility where applicable

## Traffic Growth Ideas

- Publish one supporting article or FAQ expansion per calculator around a single target query.
- Improve titles and meta descriptions based on queries that appear in Search Console.
- Add backlinks from relevant profiles, communities, and personal portfolio pages.
- Consider moving from the default `pages.dev` URL to a custom domain for stronger branding and trust.
- Keep internal links between the calculator pages strong so users and search engines discover all tools.

## Environment Variables

No environment variables are required right now.
See `.env.example` for future extension guidance.

## Development Notes

- Keep changes page-safe: do not break existing script/style paths.
- Prefer DOM APIs for dynamic table/list rendering when possible.
- Keep formatting consistent (`₹`, Indian locale separators, 2 decimal places where applicable).
- Reuse shared styles in `styles.css` instead of page-only inline styles.

## Repository Hygiene

- `.gitignore` excludes editor/system noise and common build artifacts.
- `CONTRIBUTING.md` contains contribution workflow and coding guidance.

## Documentation

- `README.md` - quick onboarding and run/deploy steps
- `DOCUMENTATION.md` - architecture and module-level technical detail
