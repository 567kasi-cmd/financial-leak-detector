# Financial Leak Detector - Technical Documentation

## 1) Architecture Summary

This is a static multi-page web app using shared JavaScript modules and CSS.

- No backend
- No package manager/build pipeline required
- Deployed as static assets on Cloudflare Pages

## 2) Runtime Entry Pages

- `/index.html` - Main debt analyzer
- `/credit-card-leak/index.html` - Credit-card-focused simulator
- `/emi-calculator/index.html` - EMI analyzer
- `/subscription-leak/index.html` - Subscription leak tracker

## 3) Shared Modules

- `calculations.js`
  - debt payoff simulation
  - EMI and amortization calculations
  - debt risk scoring
- `insights.js`
  - debt/EMI insight generation helpers
- `ui.js`
  - result rendering, charts, table rendering, interactive controls
- `styles.css`
  - shared design system and component styles

## 4) Page-Specific Scripts

- `script.js` - main page controller
- `credit-card-leak/cc-script.js` - credit card page controller
- `emi-calculator/emi-script.js` - EMI page controller
- `subscription-leak/sub-script.js` - subscription page controller

## 5) Data Flow

1. User submits a form on a page.
2. Page controller validates inputs.
3. Controller calls pure functions in `calculations.js`.
4. Results are rendered via shared UI helpers or page-specific renderers.
5. Insights are generated from `insights.js`.

All processing is client-side.

## 6) Important UI Patterns

- Amortization and monthly breakdowns are rendered as real tables.
- Long table rendering uses `DocumentFragment` to reduce repaint overhead.
- Currency values use Indian locale formatting with INR symbol.
- Scrollable table containers are used for long schedules.

## 7) Repository Hygiene

- `.gitignore` excludes editor/system/temp files and common build artifacts.
- `.env.example` is included for future env-based integrations.
- `CONTRIBUTING.md` documents contribution workflow.

## 8) Local Development

Use any static file server.

```powershell
Set-Location "C:\Users\07kas\IdeaProjects\financial-leak-detector"
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## 9) Deployment

Auto-deploy from `main` branch to Cloudflare Pages.

```powershell
Set-Location "C:\Users\07kas\IdeaProjects\financial-leak-detector"
git add .
git commit -m "your message"
git push origin main
```

## 10) Cleanup Notes (Current State)

- Removed unused legacy script `emi-calculator/emi.js`.
- Removed dead helper functions that had no project references.
- Kept structure intentionally flat/shared to avoid breaking static path imports.
