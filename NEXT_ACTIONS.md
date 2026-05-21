# Next Actions - Wegene Family Mahaber

## Immediate

- [ ] Continue Wegene tracker development locally only; do not push to GitHub or trigger Netlify until Jay says to resume.
- [ ] Next major area when Jay is ready: invoice/payment section.
- [ ] Get Jay's short description of what Wegene Family Mahaber is.
- [ ] Identify the first concrete deliverable.
- [ ] List existing materials: docs, spreadsheets, chats, websites, forms, contacts.
- [ ] Create the initial project roadmap.

## Waiting On Jay

Need project intake:

1. What is Wegene Family Mahaber?
2. What do you want this project to become?
3. What should the Director work on first?


## CEO/Director Workflow Test — Tracker MVP

- [x] Confirm pass behavior: pass queue gets priority after hosting is completed.
- [x] Use current visible member list as starting dataset.
- [x] Draft tracker MVP spec.
- [x] Create initial member/rotation JSON data.
- [x] Build first Netlify-ready static tracker prototype.
- [x] Keep payments as placeholder/link-only until tracker is stable.
- [x] Add shared/site-wide member password gate to the MVP shell. (Local demo gate refactored into shared `assets/auth.js` on 2026-05-21.)
- [ ] Add member-visible call list view inside the password-protected site. (Shell/status view added; real phone data still pending Jay-approved source.)
- [x] Keep admin tools behind separate admin protection. (Separate local demo admin gate added on 2026-05-21.)


## Tracker Clarification Actions

- [x] Study current tracker HTML, history page, and client script read-only.
- [x] Capture corrected pass-list-first rotation rule.
- [x] Draft `TRACKER_MVP_SPEC.md`.
- [x] Confirm whether pass list should show names: yes, visible to members.
- [x] Confirm call-list visibility/delivery: visible/open inside the password-protected member site for MVP.
- [x] Build initial Netlify-ready tracker prototype in `tracker-prototype/`.
- [ ] Jay/Meridian review tracker prototype flow: host, pass, pass queue priority after hosting.
- [x] Jay/Meridian confirm production auth approach and member call-list visibility for MVP.


## Password Protection / Account Setup

- [x] Capture Jay's decision: member-only password-protected site.
- [x] Choose MVP auth method: shared/site-wide member password.
- [x] Capture Jay's decision: pass-list names visible to logged-in members.
- [x] Capture Jay's decision: member call list / phone numbers visible inside the password-protected member site for MVP.
- [ ] Use project account `jakliluopenclaw@gmail.com` only when Jay explicitly approves account login/setup.
- [x] Do not write the account password into repo files, memory, or logs.


## Prototype Completed Locally

- [x] Created `tracker-prototype/index.html` static tracker.
- [x] Created JSON seed data for members, state, and history.
- [x] Implemented browser-only host/pass simulation with 21-day validation.
- [x] Implemented pass queue priority after confirmed hosting.
- [x] Created `tracker-prototype/admin.html` admin mock/protected placeholder.
- [x] Created `tracker-prototype/telegram-reminders.md` design notes without live integration.
- [x] Created `tracker-prototype/README.md` local run instructions and pending items.

## 2026-05-21 Local Site Work Status

- Added reusable local demo auth helper: `tracker-prototype/assets/auth.js`.
- Member tracker now uses the shared member gate through the helper; logout clears member session only.
- Admin page now has a separate local demo admin gate and clearly states member password does not unlock admin tools.
- Added protected member call-list status card without inventing phone numbers; real private phone data remains pending approved source.
- Verified with JS syntax checks and JSON/static smoke checks. No GitHub push or Netlify deploy was performed.
- Recommended next step: replace client-side demo passwords with deployment-safe Netlify/server-side protection before any production launch.
