# DataVerse — Learn & Analyze Data (fresh build)

React + TypeScript + Vite frontend (Framer Motion sliding transitions, aurora/glass design, dark and light themes) and a FastAPI + Pandas + SQLite backend with an optional Gemini-powered analyst.

## Run on Windows (PowerShell)

```powershell
cd C:\Users\yella\Downloads\DATAVERSE      # or wherever you unzipped this
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```
Second terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open http://127.0.0.1:5173 (or double-click `START-DATAVERSE-WINDOWS.bat`).
If PowerShell blocks activation: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Environment variables (`.env` in the project root)
| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Optional. Enables Ask AI. Without it the app says "AI offline" and everything else works. |
| `GEMINI_MODEL` | Gemini model name (default `gemini-2.0-flash`). Change it if that model is retired. |
| `DATAVERSE_DB_PATH`, `DATAVERSE_STORAGE` | SQLite file and uploaded-data folder. |
| `DATAVERSE_CORS_ORIGINS` | Allowed frontend origins. |

Frontend: `frontend/.env` may set `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).

## Tests
```powershell
pytest                       # 52 backend tests
cd frontend
npm test                     # 34 frontend render/interaction tests (vitest + jsdom)
npm run build                # type-check + production build
```

## What's in this release
- **Academy:** 11-module roadmap. 18 lessons are fully written (Foundations, SQL, Python, Statistics, Cleaning, **6 Tableau**, **6 Power BI**). Tableau/Power BI lessons include explanation, worked example, exercise, challenge, expected output, common mistakes and a quiz. Other topics are marked "Planned".
- **Tableau Studio:** lessons, a drag-and-drop worksheet *simulator* (shelves, Marks, Profit Ratio calculated field, filters, six practice checkpoints, save/reopen), and an Embed tab for your own Tableau Public / Tableau Cloud links.
- **Power BI Studio:** lessons, a report-editor *simulator* (slicers, KPI cards, column/line/donut/matrix/table visuals, cross-filtering, save/reopen), a DAX filter-context explorer (CALCULATE, ALL, YoY), and an Embed tab for your own Power BI links.
- **Visualization Lab:** a native React dashboard on the synthetic retail data. KPIs and 7 charts are computed from the filtered records; region/category clicks cross-filter; CSV download per chart.
- **SQL Lab:** read-only, single-statement, 2-second-limit queries on a copy of the practice database; 8 graded challenges checked against expected results.
- **Projects:** 10 guided projects with brief, dataset + data dictionary, checklist, validation, your findings; completion saved to your account.
- **Portfolio Studio:** profile, skills, projects, links, resume link; private by default; optional public page at `/p/<slug>`; Markdown/JSON export.
- Everything from the first release (Workspace upload/profile/clean/charts/AI/export, auth, progress).

## Simulation vs the real products
The Tableau and Power BI "simulators" are DataVerse teaching models that run in your browser on synthetic data. They are labelled as such and are not Tableau or Power BI. The Embed tabs show the *real* published page at a URL you provide (validated against Tableau Public/Cloud and app.powerbi.com hosts). DataVerse ships no demo embeds and cannot detect whether a frame loaded: if it is blank, the report needs sign-in, is unpublished, or blocks embedding.

## Not built yet / limitations
- **Not implemented:** completion certificates (quiz scores are browser-reported, so I did not issue certificates), Excel and later modules' lesson text, Hindi/Telugu lesson text, token-based Power BI embedding for private reports (needs an Azure AD app), screenshot/resume file upload, global search, Prediction/ML Lab, learning streaks, Three.js scenes (a canvas animation is used).
- SQL Lab rejects any query containing `;` inside a string literal (conservative single-statement check).
- All sample datasets are synthetic; the retail currency symbol is cosmetic.
- The session token is in `localStorage` (fine for local development; use HTTP-only cookies + HTTPS to deploy).
- Not verified: a live Gemini call (mocked in tests), `.xls` upload, real Tableau/Power BI embeds (no URLs available here), and real-browser visuals. Tests run in jsdom, which proves routes render content and filters change computed values but cannot judge layout, colour or animation quality.

## Bug found and fixed during this upgrade
Signing in could leave the page area empty and invisible: the route transition waited for an exit animation that never finished. Page transitions are now a CSS slide-in (visible by default), protected-route redirects no longer loop, and an error boundary keeps a crashing page from blanking the app. Tests cover login → home and every route.
