# Scouting History Report

A TroopWebHost (TWH) Custom Page that prints a compact **Scouts BSA Advancement Record** for any number of Scouts you pick -- current rank, BSA ID, unit position, every rank's requirement completion dates, the merit badges applied toward Star and Life, and an Eagle-required merit badge box. Each Scout gets their own printed page, in either of two views:

- **Detailed (per-requirement)** -- every rank with its numbered requirements and dates, in a three-column layout modeled on a Scoutbook-style individual advancement record. Every rank the Scout hasn't earned yet -- not just the very next one -- also lists what's **not yet** completed, dimmed with no date, alongside what is, so the whole path ahead shows in one printout.
- **One-Page Summary** -- a denser single page per Scout: rank list, full merit badge list, positions, awards, training, Order of the Arrow status, and camping/service totals, auto-shrunk to fit one Letter page.

It is read-only against TroopWebHost. Nothing is saved anywhere, and nothing leaves your browser.

> **All screenshots below use entirely synthetic data** -- invented Scouts, patrols, BSA IDs, dates, and unit number. No real member, troop, or location information appears anywhere in this folder.

---

## Screenshots

### Step 1 -- Pick your Scouts

The Scout list loads automatically as soon as the page opens, grouped by Patrol. Each Patrol has its own checkbox that selects everyone currently visible in that group, and the filter box narrows the list by name or patrol.

<p align="center">
  <img src="screenshots/01-scout-picker.png" alt="Scout picker grouped by patrol, with a filter box and per-patrol select-all checkboxes" width="50%">
</p>

### Find Scouts who are ready for a conference or board of review

Tick **Only show Scouts ready for a Scoutmaster Conference or Board of Review** and the tool checks each loaded Scout's advancement data, then keeps only those whose *only* remaining items for their next rank are the conference and/or board of review. Each match is tagged with the rank and which step is still outstanding. Patrol counts update live (for example "1 of 4").

<p align="center">
  <img src="screenshots/02-readiness-filter.png" alt="Readiness filter showing two Scouts tagged 'Star -- needs Board of Review' and 'Scout -- needs Scoutmaster Conference'" width="50%">
</p>

### Step 2 -- Build the report

Reports are fetched one Scout at a time (never concurrently -- TWH's session state races under concurrent requests). A **Stop** button appears while building; it lets the Scout currently being fetched finish and skips the rest, so an over-large selection doesn't have to be waited out.

<p align="center">
  <img src="screenshots/03-build-in-progress.png" alt="Build Report step showing a running status log and an active Stop button" width="50%">
</p>

### Detailed view

One page per Scout. Each rank lists its completed requirements with dates in two columns. Star and Life list the merit badges applied to that rank under the "Merit Badges" line (Eagle-required badges marked `#`). Eagle adds a box of the Eagle-required badge categories -- each showing its earned date, or a percent complete if still in progress -- plus a list of other earned badges and any non-required badges still in progress.

<p align="center">
  <img src="screenshots/04-detailed-view.png" alt="Detailed advancement record for a Life Scout with an Eagle-required merit badge box" width="50%">
</p>

### Every rank ahead shows what's still needed, not just the next one

Every rank the Scout hasn't earned yet pulls from a separate, troop-wide Rank Requirements Status report so it can show not-yet-completed requirements (dimmed, no date) right alongside the completed ones -- not just the very next rank, the whole path to Eagle. Already-earned ranks are unaffected; they only ever list what's done, same as before. This is also where a merit badge earned well before Star or Life finally has somewhere to show up: it appears in the Eagle-required box or "Additional Earned Merit Badges" list as soon as that block renders, which now happens for every Scout regardless of how far along they are.

<p align="center">
  <img src="screenshots/07-in-progress-requirements.png" alt="An Eagle rank block, not yet earned, showing some requirements completed with dates and others dimmed as not yet done" width="50%">
</p>

### One-Page Summary

The same Scouts, one dense page each. The page's font size steps down (10pt to a 6pt floor) based on the real rendered height until everything fits one printed Letter page.

<p align="center">
  <img src="screenshots/05-one-page-summary.png" alt="One-page consolidated summary for an Eagle Scout" width="50%">
</p>

### Follows your site's theme

Like the other pages in this repo, it probes the live TWH theme at load and adapts its colors -- including switching between light and dark.

<p align="center">
  <img src="screenshots/06-dark-theme.png" alt="The Scout picker under a dark site theme" width="50%">
</p>

---

## Installing

1. In TroopWebHost, go to **Manage Custom Pages** and open (or create) a Custom Page.
2. Open the page's **HTML editor** and paste the **entire contents** of `scouting-history-report.html`.
3. Save and view the page.

The page must run **on troopwebhost.org** so its requests inherit your logged-in session. It will not work pasted into an external site or previewed from a local file -- the requests are blocked without your session cookie.

## Using it

1. **Select Scouts.** The list loads on its own. Check individual Scouts, a whole Patrol, or **Select all shown**. Use the filter box and/or the readiness checkbox to narrow the list first if you like.
2. **Build Report.** Fetches each selected Scout's Scouting History Report and builds both views at once.
3. **Choose a view.** Toggle **Detailed** and **One-Page Summary** instantly -- no re-fetch.
4. **Print / Save as PDF.** Uses your browser's own print dialog. Each Scout starts on their own page. No PDF library is involved.

## What it fetches

Three reports, in this order:

| # | Purpose | TroopWebHost endpoint |
|---|---------|-----------------------|
| 1 | Scout Directory (name, patrol, BSA number) -- builds the checklist | `FormReport.aspx?Menu_Item_ID=46012` |
| 2 | Scout BSA ID admin grid -- maps each Scout to TWH's internal person ID | `FormList.aspx?Menu_Item_ID=56934&Form_ID=3547` |
| 3 | Rank Requirements Status -- every rank requirement for every Scout, one fetch for the whole troop | `FormReport.aspx?Menu_Item_ID=55384` |
| 4 | Scouting History Report, once per selected Scout | `FormReportMultiSection.aspx?Menu_Item_ID=56926&Form_ID=1005&FK=<id>&ID=<id>&Stack=2&ReportFormat=XLS` |

Step 2 is required, not optional: report 4 is fetched by internal person ID, and this grid is the only place TWH exposes it. Scouts are matched to it by BSA number first (immune to nickname/preferred-name differences), then by name for anyone without a BSA number on file. Anyone who still can't be matched is listed with an "ID not found" note and can't be selected.

Step 3 is the only report found so far that lists a rank's **full** checklist -- done and not done -- with TWH's own short requirement wording (e.g. "Scout Spirit", "Board of Review") and a blank Date Earned for anything not yet done. It's fetched once, up front, for the whole troop -- not per Scout -- and every Scout is matched against it by name (same matching as step 2). Being a plain report (`FormReport.aspx`, like step 1) rather than a custom admin form makes it more likely, though still not certain, to be a stable Menu_Item_ID across different troops' installs. This fetch is optional: if it fails, a status note says so and the report still builds for every Scout, just without any "still needed" lines -- every rank then shows only what's completed, same as if this feature didn't exist.

Despite the `.XLS` extension, report 4 (unlike most other `ReportFormat=XLS` exports on TWH, which are plain CSV) is a genuine binary Excel workbook. It is parsed client-side with [SheetJS](https://sheetjs.com/) for member info, the rank table, merit badge tables, awards, positions, training, totals, and OA status -- rank *requirement* detail comes from report 3 instead.

## Required access

Your TroopWebHost login must be able to open reports 1, 2, and 4 -- in practice, **Leader-level access**, including the Membership Hub's Scout BSA ID admin grid. If a fetch is redirected (TWH's way of denying access), the tool shows a **Restricted** message explaining what's missing instead of failing silently; if only the per-Scout history report (4) is denied, that Scout is reported as "access denied" in the build log and the rest continue.

Report 3 (Rank Requirements Status) is designed to fail soft: if your login can't reach it, or it comes back in an unexpected shape, everything else works exactly as before -- you just won't see not-yet-completed requirements for anyone's current rank, and a status note says so.

## Good to know

- **Completed vs. not-yet-completed.** Every already-earned rank only ever lists what's done. Every rank the Scout hasn't earned yet -- not just the very next one -- shows not-yet-completed items too (dimmed, no date), both sourced from the Rank Requirements Status report; if that report isn't available, every rank falls back to showing nothing rather than guessing. Only the very next rank gets the italic "In Progress" label; ranks further out just show no date.
- **Rank date is "earned," not "awarded."** The awarded (ceremony) date isn't always recorded even once a rank is fully earned, so the earned date is used and the awarded date is only a fallback.
- **The "Position" line** shows whichever position(s) currently have no end date on file (or a future one). If none do, it falls back to the most recently held position. The one-page summary shows full position history.
- **Eagle-required badges come from TWH itself.** They are detected via TWH's own leading `*` on the badge name in the earned table. For badges still *in progress* (which carry no `*`), whether one counts toward Eagle is checked against a fixed list of the official Eagle-required categories built into the page.
- **"Additional Earned Merit Badges"** on the Eagle page means earned badges that are neither Eagle-required nor applied to Star or Life -- a simplification, since TWH's data model doesn't cleanly recover a three-tier grouping.
- **The readiness filter reads the same Rank Requirements Status report**, using each Scout's Current Rank to find their in-progress rank and flagging them when the *only* unfinished lines match "Scoutmaster conference" and/or "board of review" in TWH's own wording -- no hardcoded requirement-code table to keep in sync with BSA revisions. It needs no extra fetch beyond loading the Scout list, so it runs instantly.
- **One page isn't always possible.** A very advanced Scout's history may not fit one page even at the 6pt floor. That Scout then spills cleanly onto a second page, and a note names who.
- **Only `cdn.sheetjs.com` is used for scripts.** This repo's pages can only reliably load scripts from that host on TWH; other CDNs have been blocked in live testing (an earlier jsPDF-from-CDN attempt for the one-pager failed that way), which is why printing relies on the browser rather than a PDF library.
- **Undocumented endpoints.** TWH has no public API; these endpoints were discovered from HAR captures and can change without notice.

This is an unofficial community tool. It is not affiliated with or endorsed by Scouting America, Scouts BSA, or TroopWebHost, and its layout is modeled on -- not copied from -- any particular vendor's report.

## Regenerating the screenshots

`gen_screenshots.js` runs the actual shipped `scouting-history-report.html` in headless Chromium against an in-memory fake TroopWebHost: a synthetic Scout Directory (7 Scouts across two patrols at different advancement stages, including one Scout ready for a Board of Review and one ready for a Scoutmaster Conference), a fake BSA ID grid, a fake Rank Requirements Status CSV covering all 7 Scouts and every rank (built from the same per-Scout done/not-done fixtures), and genuine binary `.xls` history workbooks for the rest of each Scout's data. Nothing touches a real TWH site.

```bash
npm init -y
npm i puppeteer-core @sparticuz/chromium xlsx@0.18.5
node gen_screenshots.js            # expects scouting-history-report.html beside it
node gen_screenshots.js path/to/scouting-history-report.html
```

PNGs are written to `screenshots/`. SheetJS is served to the page from the local `xlsx` package, so the script doesn't need to reach the CDN.
