# Wegene Family Mahaber - Project Brief

## Owner

Master Jay

## Director Agent

Wegene Director 🌿 (`director-wegene-family-mahaber`)

## Current Status

Tracker MVP direction is now confirmed: build a member-only Netlify site protected by a shared/site-wide member password, with admin tools separately protected.

## Known Scope

**Wegene Family Mahaber** manages all affairs related to the Wegene Family Mahaber.

Known details from Jay:

- About 25 primary members, not counting spouses and kids.
- Current systems include two websites that accept PayPal-linked payments.
- Current systems include a hosting tracker for the every-two-month family get-together.
- First reviewed site: https://wegene-jaklilu.pythonanywhere.com/
- Jay wants a new Netlify site built/managed by the Director.

## Website Review Summary

The first provided site appears to be a family hosting tracker. It lists member/family names, tracks who has hosted, shows who should get ready, allows host/pass actions, includes a history page, and has an admin page.

Observed concerns:

- Member/family names are publicly visible.
- Current implementation may be fragile or harder to maintain long-term.
- Admin security and privacy controls need review.
- Better role-based access, backups/export, and audit trail may be needed.

## Recommended Netlify Direction

Start with a simple, useful Netlify site:

- Home/dashboard
- Hosting tracker
- Hosted dates shown in the main tracker
- Payments page linking to existing PayPal flows
- Admin area
- Later: member directory, payment tracking, auth, export, reminders, and PayPal webhook integration if needed


## Confirmed Direction from Jay

- Superseded by later privacy decision: the MVP tracker should be member-only behind a shared/site-wide member password.
- Member/family names and pass/hosted status labels may be visible to logged-in members for MVP; member call list is removed for now.
- Admin tools remain separately protected and should not be accessible with only the member password.
- Host rotation is currently automatic; new tracker should preserve or improve automatic rotation.
- Wegene collects monthly dues, but invoices are sent every four months through PayPal.
- No spouse/kid records are needed for now. Use the visible member list as the starting dataset.
- First project priority: enhance/rebuild the host tracker and use this as the first CEO/Director workflow test.

## Second Website Review

Second site: https://wegene.pythonanywhere.com/

It appears to be an invoice lookup portal titled “Find Your Invoice” / “Check Your Invoice” where a member enters a phone number to find invoice/payment status. No phone numbers were submitted and no payment actions were taken.

Recommended future fit:

- Keep payments separate from the first tracker MVP.
- Later add a `/payments` page that links to PayPal invoices or shows imported/manual payment status.
- Jay wants to work on the invoice/payment section next time when ready.
- Avoid PayPal webhook integration until the tracker MVP is stable.

## Tracker MVP Recommendation

Pages:

- `/` member dashboard / current host tracker, behind shared member password
- Hosted dates shown directly in the main tracker instead of a separate history page
- `/members` member-visible member list, without call list for now
- `/payments` placeholder/link area for existing PayPal invoice flow, member-visible only
- `/admin` separately protected admin management area

Automatic host rotation recommendation:

1. Keep members in a fixed assigned rotation order.
2. Current/get-ready member can choose host or pass.
3. If member hosts, they select/schedule a date at least three weeks out.
4. If member passes, label them Passed in the main tracker and continue normal assigned order.
5. After a scheduled hosting is confirmed complete, show the hosted date in the main tracker and move that member to the bottom of the rotation list.
6. The next active member in the list becomes Get Ready so the list keeps going.
7. Admin can override when needed.

## Open Questions

1. Who are the admins, treasurer, or organizers?
2. What do the two PayPal/payment sites collect: dues, donations, events, fines, other?
3. Should PayPal payments only link out, or eventually integrate PayPal webhooks?
4. Is member data already in a spreadsheet, or should the first database be created from scratch?
5. Which platform/data store should hold production tracker state after the static prototype?

## Next Recommended Step

Turn the local tracker prototype into a production MVP shell: member password gate first, tracker pages second, admin area separated third.


## Corrected Tracker Rotation Rule

Jay clarified that the intended automatic rotation uses a pass list, not simply “move passer to the end of the round.”

Correct behavior:

- Members follow an assigned order.
- Current member chooses host or pass.
- If they host, they choose a date at least three weeks from today.
- If they pass, they go to the pass list.
- Once someone hosts, their hosted date is shown in the main tracker and they move to the bottom of the rotation list.
- The next active member in the list becomes Get Ready so the list keeps going.

See `TRACKER_MVP_SPEC.md` for current MVP specification and `MVP_BUILD_PLAN.md` for the first implementation steps.


## Access / Security Direction

- New tracker should be password-protected so only Wegene members can access it.
- MVP auth method: shared/site-wide member password.
- Pass-list names can be visible to members.
- Member call list is removed from the member MVP for now.
- Netlify/GitHub/Gmail project account email: `jakliluopenclaw@gmail.com`.
- Development mode for now: local-only. Do not push new changes to GitHub or trigger Netlify deploys until Jay says to resume, likely next month.
- Do not store account password in files or memory. Use credentials only with Jay's explicit approval for login/setup actions.
