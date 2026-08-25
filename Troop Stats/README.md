# Annual Planning Meeting Dashboard

A single-file, no-build dashboard for BSA troops on [TroopWebhost](https://www.troopwebhost.org) that pulls live roster and activity data straight from the site and rolls it up into the numbers you need for an annual planning meeting: how many scouts are on the roster, how many are actually active, rank advancement, merit badges earned, service hours, patrol-level campout attendance, and year-over-year trends.

Everything runs client-side in the browser. No backend, no build step, no file uploads — one button pulls everything.

## What it shows

- **Scouts on Roster** — current youth count (rows with no `Left Unit` date; adults are filtered out automatically).
- **Active Scouts** — scouts who attended at least a configurable percentage of qualifying events (see [Active Scout threshold](#header-controls)) in the last 12 months. The percentage is measured only against events that happened while the scout was actually in the troop — a departed scout isn't judged against events after they left, and a scout who joined partway through the year isn't judged against events before they joined.
- **Advanced ≥1 Rank** — unique scouts with a rank advancement in the last 12 months.
- **Merit Badges Earned** — total merit badges earned in the last 12 months, and how many distinct scouts earned them.
- **Service Hours** — Service + Conservation Hours summed from Event Participation, last 12 months.
- **Patrols** — youth count by patrol.
- **Scout Roster — Activity Summary** — one row per scout (Scout, Status, Patrol, Rank, Active %, Ranks Advanced, Merit Badges, Service Hours), fully sortable by clicking any column header. Includes departed scouts (marked with a "Departed" badge) when that toggle is on.
- **Patrol Attendance by Campout** — one row per Cabin Campout/Campout event, with a column per patrol showing how many of that patrol's scouts attended. Always scoped strictly to campout-type events, independent of the Active Scouts event-type checkboxes.
- **Year-over-year deltas** — every stat card shows a small badge (▲/▼ and a %) comparing the current 12-month window to the same window one year earlier, when enough data is available to compute it.

## Access restriction

The page only shows itself to accounts that can actually pull the reports it needs. On load, it silently probes the Roster report; if that fails (logged out, or the account's TroopWebhost role doesn't have report-pulling permission), everything stays hidden behind a **"This page is restricted to Adult Leaders"** message instead of showing controls that wouldn't work anyway. If the probe succeeds, that same roster pull is reused when you click the button, so nothing gets fetched twice.

This is a UX gate, not a security boundary — the real access control is TroopWebhost's own server-side permission check on the report endpoints, which this can't bypass or weaken. Viewing the page source would show the hidden markup underneath the message, but that markup can't get real data without TroopWebhost itself authorizing the account. TroopWebhost's Custom Page editor doesn't have a native "restrict this page to Leaders" setting as of this writing — if that ever changes, applying it at the page level would be the more robust fix, but this probe is a reasonable stand-in either way. It's also only as accurate as "can pull these reports" actually maps to "is a Leader" — if some other role on your troop's site happens to share (or lack) that same report permission, the message would apply to them too, whether or not that's the intent.

## How it works

This page pulls its data live from TroopWebhost's own endpoints using `fetch()`. That only works because of same-origin credentials — the browser automatically includes your logged-in TroopWebhost session cookie when the request is made *from a page hosted on troopwebhost.org*. That's why this has to be installed as a **TroopWebhost Custom Page**, not opened as a standalone local file — opened any other way, the live pull will fail with a same-origin/auth error.

On load, the page silently pulls the Roster report as an access check (see [Access restriction](#access-restriction) above). Once that succeeds, clicking **Pull latest & build dashboard** does two more things:

1. Fetches the current list of event types from TroopWebhost's own Event Types admin page (a real HTML table, not a CSV export), so the "count these event types toward Active Scouts" checkboxes always reflect what your troop's site actually has configured — not a hardcoded guess. This is best-effort: if it fails, the checkboxes fall back to a built-in list of common types and the rest of the dashboard still builds fine.
2. Pulls the remaining CSV-style reports (Roster is already cached from the access check above) and builds the dashboard from them:

| Report | Menu_Item_ID | Feeds |
|---|---|---|
| Roster (full, includes departed) | `45897` | Scouts on Roster, Patrols, current Rank, join/departure dates |
| Event Participation | `45935` | Active Scouts, Service Hours, Patrol Attendance by Campout |
| Rank Advancement History | `46044` | Ranks Advanced |
| Merit Badge History | `46045` | Merit Badges Earned |

The Roster report is TroopWebhost's *unfiltered* export — every member, current and departed, in one file. A row counts as "currently on the roster" if its `Left Unit` column is blank; a populated `Left Unit` date instead feeds that scout's departure date, and `Date Joined Unit` feeds their join date — both used to narrow the Active % denominator to the window a scout was actually present for. This is deliberately the wider export rather than the narrower "Active Roster" report, so all of this comes from one file — see [Known limitations](#known-limitations) for the privacy trade-off that comes with that.

Column mapping (which header is "Scout Name," "Date," etc.) is auto-detected by matching against known TroopWebhost header names. There's no manual file upload or column-mapping UI anywhere on the page — the button is the only way data gets in, and clicking it again once data is already loaded just recomputes with your current settings instead of re-fetching (reload the page to force a genuinely fresh pull).

## Installation

1. Open your troop's **TroopWebhost Custom Page editor**.
2. Paste the entire contents of `annual-planning-dashboard.html` in as raw HTML.
3. Save/publish the page.
4. Open the page while logged into TroopWebhost, and click **Pull latest & build dashboard**.

If your Custom Page editor sanitizes/strips `<script>` tags, this won't work — check for a "raw HTML" or "advanced" mode. The file is plain ASCII (no raw Unicode characters anywhere — see [Known limitations](#known-limitations)), which sidesteps one common cause of corrupted symbols after a paste-and-save round trip, but a `<script>`-stripping editor is a different, unrelated problem this can't work around.

## Header controls

- **Troop name** — cosmetic label only.
- **"As of" date** — defines the trailing 12-month window every metric uses. Defaults to today; change it to back-date the report to a specific meeting date.
- **Active Scout threshold** — the % of eligible events a scout must attend to count as "active." Set to `0` to count anyone who attended at least once.
- **Count scouts who've since left the troop** — when checked, activity from scouts no longer on the current roster (aged out, transferred, etc.) still counts toward the aggregate stats and shows up in the roster table with a "Departed" badge. Their Patrol and current Rank show as `—` since that data doesn't exist for anyone off the live roster.
- **Event type checkboxes** — which Event Participation types count toward "Active Scouts." Pulled live from TroopWebhost's own Event Types list (see [How it works](#how-it-works)); pre-checked: Cabin Campout, Campout, Community Service. These checkboxes have no effect on the Patrol Attendance by Campout table, which is always scoped to campout-type events only.

## Known limitations

- **The Roster report is wide.** TroopWebhost's full roster export includes ~90 columns, some of them genuinely sensitive — medical info, allergies, driver's license, health insurance, home address. The tool only ever reads Name, Patrol, Rank, Adult, Left Unit, and Date Joined Unit from it; nothing else is parsed, displayed, or stored — but that full row set does briefly exist in browser memory during the pull.
- **Departure/join date is an approximation when the roster fields are missing.** If a scout's row has no `Left Unit` value despite having left, the tool falls back to inferring a cutoff from their most recent activity date across the other three reports, which isn't always right (e.g. a merit badge processed after someone's actual departure would push the inferred date later than reality). Without `Date Joined Unit`, a recently-joined scout is measured against the full 12-month window instead of just the months since they joined.
- **Event de-duplication depends on an Event Name column.** Active % and Patrol Attendance by Campout both group attendance by event, using the report's Event name + date. If a report is missing an event-name column, it falls back to grouping by date alone, which would under-count if two qualifying events happen to land on the same day.
- **Patrol Attendance by Campout uses each event's own Patrol value**, not the roster's current patrol assignment, since scouts change patrols periodically and attributing an old campout to a scout's *current* patrol would misattribute it. Column names are whatever patrol values actually appear in that report, which can differ in naming/casing from the roster's patrol names.
- **Year-over-year deltas are a simplified recomputation**, not a full replay of the current year's logic — they don't apply the individual join/departure-cutoff refinement to prior-year Active %, for instance. Good for a directional comparison, not a perfectly apples-to-apples one.
- **Name matching is normalization-based, not exact.** Names are matched across reports by lowercasing, stripping punctuation, and comparing sorted word sets — so "Smith, John" matches "John Smith," but "Johnny" won't match "Jonathan." Mismatches show up in the unmatched-names panel for manual review.
- **Requires TroopWebhost's report URLs to stay stable.** If TroopWebhost ever changes its `Menu_Item_ID` values or report formats, the live pull will start failing and the IDs in the table above will need updating. The Event Types list is more resilient to this than the four CSV reports, since it's found by locating the "Event Type" column header rather than any fixed page structure.
- **The access gate (see [Access restriction](#access-restriction)) is a UX convenience, not enforcement.** It infers "Adult Leader" from "can pull the Roster report," which is an approximation, and it can't be relied on to keep anyone out — TroopWebhost's own server-side permissions are what actually protect the data.

## Tech notes

- Single HTML file, no build step. Uses [SheetJS](https://cdn.sheetjs.com) to parse the CSV report responses, and the browser's native `DOMParser` to parse the HTML Event Types page.
- The entire file is plain ASCII — every symbol (checkmarks, arrows, dashes, ≥, etc.) is either an HTML entity in markup or a `\uXXXX` escape in JS strings. This is deliberate: TroopWebhost's Custom Page editor doesn't reliably preserve raw multi-byte UTF-8 characters on save, which was previously showing up as literal `?` characters on the page after a paste-and-save round trip.
- All CSS is scoped under a single `.apm-dashboard` wrapper class so it can't leak into the rest of the TroopWebhost site when pasted into a Custom Page.
- Both buttons explicitly set `type="button"` — TroopWebhost's pages run inside an ASP.NET `<form>`, and an unset button type defaults to `submit`, which triggers a full-page postback and wipes out everything the page just rendered.
