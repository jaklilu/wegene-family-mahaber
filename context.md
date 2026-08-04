# Wegene Family Mahaber — Context

Last updated: 2026-08-03

This file is the working context for the hosting tracker: what existed before the Aug 2026 build push, what was built/changed, and how the live site works now.

---

## Owner & project

- **Owner:** Master Jay
- **Project:** Wegene Family Mahaber — family hosting / mahaber affairs
- **Primary goal (this phase):** Rebuild/enhance the **hosting tracker** as a member-only Netlify site
- **GitHub:** `https://github.com/jaklilu/wegene-family-mahaber`
- **Live site:** `https://wegenefamilymahaber.netlify.app/`
- **Older PythonAnywhere trackers (legacy):**
  - `https://wegene-jaklilu.pythonanywhere.com/` (hosting tracker)
  - `https://wegene.pythonanywhere.com/` (invoice lookup — future payments work)

---

## Background (before the Aug 2026 UI/sync work)

### Why a new tracker

- Legacy tracker listed members publicly and was harder to maintain.
- Jay wanted a Netlify-hosted MVP managed cleanly, with privacy and admin separation.
- About ~25 primary members (no spouse/kid records for now).
- Family also has PayPal dues/invoices; **payments are out of scope for this tracker MVP** (next phase).

### Early product direction (May 2026)

Documented in `PROJECT.md`, `TRACKER_MVP_SPEC.md`, `DECISIONS.md`, `MVP_BUILD_PLAN.md`:

- Shared **member password** gate for the member site
- Separate **admin password** for admin tools
- Pass/hosted status visible to logged-in members
- Member call list removed from member MVP (phones pending approval)
- Do not commit real secrets/tokens
- Automatic rotation should be preserved/improved
- Telegram reminders: design notes only (`tracker-prototype/telegram-reminders.md`), no live integration yet

### Prototype foundation (`tracker-prototype/`)

A static Netlify-ready prototype was already in place:

| Area | What existed |
|------|----------------|
| Pages | `index.html` (member tracker), `admin.html` (admin tools) |
| Data seed | `data/members.json`, `data/state.json`, `data/history.json` |
| Client logic | `assets/app.js`, `assets/admin.js`, `assets/auth.js`, `assets/config.js`, `assets/styles.css` |
| Storage | Browser `localStorage` (per device) |
| Deploy | Root / prototype `netlify.toml` publishing static files |

Original README still describes some older behaviors (Pass/Host, 21-day validation). **Those member Pass/Confirm-hosted controls were later removed** from the member UI; admin still has mark-hosted / management tools.

---

## Agreed hosting rules (canonical)

Agreed around **2026-08-02 / 2026-08-03**:

1. Hosting is **every 3 months**.
2. Default day is the **first Sunday** of the hosting month (optional change to **Saturday**).
3. Host may move the date **±1 week**.
4. Emergency: host may **swap places** with another member (names move; the calendar spots stay).
5. **Start:** **Hana** on **Sunday Nov 1, 2026** (about 3 months after Aug 3, 2026).
6. Prior hosted examples in seed history: Mengistu (2026-04-05), Wosene (2025-09-14).

Seed schedule notes live in `tracker-prototype/data/state.json` → `scheduleRule`.

---

## What was built / changed (Aug 2026 session)

### Auth (client demo)

- Member password: `Wegene2026!`
- Admin password: `AdminDemo2026!`
- Defined in `tracker-prototype/assets/config.js`
- Session keys in `sessionStorage` via `assets/auth.js`
- Sticky menu: Tracker / Admin / Log out; mobile hamburger (`assets/nav.js`)

> Production note: these are **client-side demo gates**. Real production should use Netlify/server auth or similar. Optional env: `TRACKER_WRITE_PASSWORD` for the shared API write gate (defaults to member password).

### Turn card / member UI

- Title: **Wegene Family Mahaber** with small logo (no “Tracker” in H1)
- Headline stack:
  1. “Our next mahaber is…”
  2. Large date: `Sunday Nov 1, 2026`
  3. `Name - You Are Next` or `Name - Confirmed`
- No avatar on the turn headline (avatars remain in the rotation list)
- Typography:
  - Mobile: name/status larger; date remains dominant
  - Desktop: name large; “You Are Next / Confirmed” smaller, **baseline-aligned** with the name
- Date actions: Change Saturday/Sunday, 1 week earlier, 1 week later
- Week/weekend changes show **new date + green Confirm** before save (not a toast like “moved one week…”)
- After Confirm on a date change: status becomes **Confirmed**
- Member UI: **no Pass / Confirm hosted** (admin still has mark-hosted tools)
- Mobile: equal tall buttons; same 3-button row layout as desktop

### Swap behavior

- Select member → **Swap dates**
- If no one selected: **obvious red notice** + highlight/focus the dropdown  
  (“Choose a family member to swap with first.”)
- Then in-page: “Have you confirmed with [Name]?” → **Yes** (green) / **No** (red)
- **Yes:** swaps **date, weekday, and rotation position** (people trade spots; dates stay on the slots)
  - Example: Hana (Nov 1, 2026) ↔ Derege (Aug 1, 2027) → Derege gets Nov 1 and becomes next; Hana gets Aug 1
- **No:** cancels quietly, returns to main view (no “swap cancelled” toast)
- Post-swap “Get Ready…” toast removed
- Do **not** show “Derege takes … / Hana takes …” copy in the confirm prompt (understood)

### Host Confirm + 30-day change lock

- Under swap: green button **`{Name} - Confirm Date MM/DD/YYYY`**  
  Example: `Hana - Confirm Date 11/01/2026`
- After confirm: button becomes **`{Name} - Confirmed`** (disabled)
- Plain text under the button (not a button):  
  **`Only X days left to change dates`**
- When within **30 days** of the mahaber:
  - Saturday / ±1 week moves are **locked**
  - Timer: `Date moves locked · swap still OK`
  - **Emergency swap remains allowed** if someone agrees

### Shared sync across devices (PC vs phone)

**Problem:** PC showed Hana Nov 1; phone showed Oct 25 — `localStorage` is per device.

**Solution:**

- Netlify Function: `netlify/functions/tracker-data.mjs`
- API path: `/api/tracker-data` (GET read / POST write)
- Storage: **Netlify Blobs** (`@netlify/blobs`)
- Client: `tracker-prototype/assets/store.js`
  - Prefer shared remote data
  - If remote empty → publish seed (canonical Nov 1)
  - If API down → fall back to local
- Root `package.json` + `npm install` build step so Blobs dependency deploys
- `netlify.toml`: `command = "npm install"`, publish `tracker-prototype`, esbuild bundler for functions
- Local storage key bumped over time (currently **`wegene-tracker-mvp-v9`**) to clear stale per-device drift

After deploy: hard-refresh PC + phone so both load shared Nov 1 (until someone saves a new change).

### Admin tools (`admin.html` / `admin.js`)

Still available behind admin password:

- Reorder members, set Get Ready, pass queue, assigned dates
- ±1 week / Saturday-Sunday helpers
- Emergency swap
- Rebuild quarterly schedule from rotation order
- Mark hosted & advance
- Export backup / reset to seed
- Uses the same shared store when available

---

## Current seed rotation (head of list)

1. Hana — 2026-11-01 (Sunday) — **current / You Are Next**
2. Eyob — 2027-02-07
3. Mekurab — 2027-05-02
4. Derege — 2027-08-01
5. Alem — 2027-11-07  
…through Wosene, then Mengistu / Yoni at the bottom after prior hosting.

Full list: `tracker-prototype/data/members.json`.

---

## Repo layout (important paths)

```text
netlify.toml                          # build: npm install; publish tracker-prototype
package.json                          # @netlify/blobs
netlify/functions/tracker-data.mjs    # shared GET/POST API
tracker-prototype/
  index.html                          # member tracker
  admin.html                          # admin tools
  assets/
    app.js                            # member UI + rules
    admin.js                          # admin UI
    store.js                          # shared + local storage
    schedule.js                       # dates, swap, quarterly assign
    auth.js / config.js / nav.js
    styles.css
  data/
    members.json / state.json / history.json
```

Other project docs: `PROJECT.md`, `TRACKER_MVP_SPEC.md`, `DECISIONS.md`, `MVP_BUILD_PLAN.md`, `NEXT_ACTIONS.md`, `tracker-prototype/README.md` (partially outdated vs current UI).

---

## How to run locally

From `tracker-prototype/`:

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`  
Do not open `index.html` via `file://` (JSON fetch will fail).

Shared API only works on Netlify (or with functions emulated); offline falls back to localStorage.

---

## Deploy workflow used in this phase

- Repo remote: `origin` → `jaklilu/wegene-family-mahaber` (`main`)
- Changes were committed and pushed to `main`; Netlify auto-deploys
- After UI/sync changes: hard refresh on each device

---

## Passwords & env (demo)

| Gate | Value / note |
|------|----------------|
| Member | `Wegene2026!` (`config.js`) |
| Admin | `AdminDemo2026!` (`config.js`) |
| API write | `TRACKER_WRITE_PASSWORD` env, else member password |

Do not treat these as long-term production secrets.

---

## Still pending / next

- Approved member photos
- Real production auth (replace client-side password demo)
- Payments / invoice section (Jay’s next major area when ready)
- Live Telegram reminders
- Optional: refresh `tracker-prototype/README.md` so it matches current rules (quarterly schedule, Confirm + 30-day lock, shared Blobs, no member Pass button)
- Optional: Netlify Identity / stronger write protection on `/api/tracker-data`

---

## Quick “how it should feel”

1. Log in with member password.
2. See next mahaber date large, then **Hana - You Are Next**.
3. Adjust Saturday/week if needed → Confirm the new date.
4. Or press **Hana - Confirm Date 11/01/2026** to confirm hosting.
5. Watch **Only X days left to change dates** under that button.
6. Inside 30 days: can’t move Sat/week; can still swap if someone agrees.
7. Swap = trade places with another member after Yes; No returns to the page quietly.
8. PC and phone stay in sync via Netlify Blobs after refresh.
