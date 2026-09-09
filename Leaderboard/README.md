# Troop All-Time Leaderboards

A self-contained page for TroopWebHost troop sites that shows
leaderboards for Camping Nights, Hiking Miles, Service Hours, Conservation Hours
Backpacking Miles, Cycling Miles, Paddling Miles, and Merit Badges —
split by Scout/Adult and Active/Former/All.

It runs entirely inside TroopWebHost as a Custom Page. Seven categories
update live on every page load; Merit Badges and former-member data
are refreshed and published automatically, in the background, the
next time a leader with the right permissions opens the page — no
button to click, no admin panel to open (no addresses, medical info,
or other sensitive fields ever leave that action — just names and
totals).

<p align="center">
<img width="421" height="533" alt="image" src="https://github.com/user-attachments/assets/de485f81-6c75-4d15-a3c0-4a85549fcd56" />
</p>


The code works by scraping the **Event Participation Summary for Date Range** and the **Export Roster to Excel** reports for the data.  By default only the **Adult Leader** and **Event Planner** roles have access to the **Event Participation Summary for Date Range report**, but you can grant the **View Event Participation Reports** task to other roles, without concern of granting too much access.  The **Export Roster to Excel** report contains more sensitive data, and for that reason, should not be granted to more roles.  By default anyone with the **Rank Advancement** and **Membership** roles should have access to it.

The **Event Participation Summary for Date Range** report contains Total Camping, Total Cabin Camping, Total Service Hours, Total Conservation Hours, Total Conservation Hours, Total Hiking Miles, Total Backpacking Miles, Total Cycling Miles, Total Paddling Miles, Total Motor boarding Miles, Total Water Hours, Total Horseback Miles, and Total Skating Miles for anyone who is or has been a member of the Troop.

The **Export Roster to Excel** report contains Camping Nights, Total Hiking Miles, Total Service Hours and Number of Merit Badges for anyone who is or has been a member of the Troop.  This also has date that someone left the troop, thus being able to determine who is a current and who is a former member.

With the correct permissions granted to all members, the Active Scout/Adult data, with the exception of Merit Badges is always live, while the Former Scout/Adult and Merit Badge data is refreshed and published automatically, in the background, whenever a leader with the correct permissions loads the page.  The Former Scout/Adult data only needs to be updated when someone's membership is changed, since their stats will not change once they are a former member, or when Active Scouts earn new Merit Badges — so it's fine if it only refreshes whenever a leader happens to load the page next, rather than instantly.

This code uses [SheetJS](https://sheetjs.com/) to parse Excel reports exported from TroopWebHost.

# Setup Guide



You do **not** need any coding tools — everything runs inside
TroopWebHost itself. Setup is mostly pasting the script in and setting
a couple of permissions.

---

## What you'll need

- Admin access to your troop's TroopWebHost site
- Access to Manage Custom Pages
- Someone with the **View Membership Information** and **Web Page
  Editor** tasks (needed for former-member and merit-badge data to
  auto-publish — see Step 3)
- A modern browser, only needed to check DevTools (F12) console
  messages if something doesn't work out of the box


---

## Step 1 — Create the Custom Page

1. In TroopWebHost: **Menu > Home > Manage Custom Pages**, then click
   **Add a New Item.**
2. Give it a name (e.g. Troop Leaderboards), and set the proper Menu
   Sequence for your site.
3. Click **Save & Exit.**
4. Navigate to the new page: **Menu > Home > (your page name, e.g.
   Troop Leaderboards).**
5. In the upper right-hand corner, click the **Gear icon → Edit This
   Page.**
6. Click the **plus sign** to add a new section.
7. Leave the Type as **My Content**, set the other options as you
   wish, and click **OK.**
8. When the editor pops up, don't paste the code here — just hit
   **Save.**
9. Click **Source.**
10. Paste the entire script into the content box.
11. Click **Save.**
12. In the upper right-hand corner, click the **Gear icon → Exit Page
    Edit.**

Open the page and confirm the 6 live categories load with real
numbers. If something's wrong, open the browser console (F12) — error
messages there will point at what failed.

## Step 2 — Grant permission for live data

Everyone who should see the live (Active) leaderboard data needs the
**View Event Participation Reports** task:

**Menu > Administration > Security Configuration > Assign Tasks to
Roles**

Assign the **View Event Participation Reports** task to both the
**Adult** and **Scout** roles (or whichever roles you want to have
access).

## Step 3 — Former-member and merit-badge data publishes itself

Nothing to configure here. The first time anyone with the **View
Membership Information** and **Web Page Editor** tasks opens the
page, it automatically:

1. Pulls the roster export and merit-badge/former-member numbers.
2. Finds this page's own Custom Page section (no site-specific value
   to look up or paste in — it works this out on its own).
3. Saves the refreshed data straight back into the page's source, so
   every future visitor — leader or not — sees it too.

All of this happens in the background; the leader who triggered it
doesn't need to do or click anything, and won't see a difference
other than the Former/Merit Badges tabs having current data. Anyone
without those two tasks just sees whatever was published most
recently — nothing to do on their end either.

Since it only refreshes when a leader with the right tasks happens to
load the page, there's no fixed schedule — but that's fine, since this
data only changes when someone's membership status changes or an
Active Scout earns a new Merit Badge.





---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything blank, error shown | The viewer lacks the View Event Participation Reports permission (Step 2), or one of the Known site-wide values doesn't match your site — see below |
| Former tab always empty | No one with the View Membership Information and Web Page Editor tasks has opened the page yet (Step 3) |
| Merit Badges tab always empty | Same as above — Merit Badges is published only, not live |
| Former/Merit Badges data looks stale | It only refreshes when a leader with the right tasks loads the page — have one of them open it again |


---

## Known site-wide values

These report IDs appear to be the same across every TroopWebHost
site, not specific to any one troop — they're already set correctly
in the script, so you shouldn't need to touch them:

| Variable | Value | Report |
|---|---|---|
| MENU_ITEM_ID | 46097 | Event Participation Summary For Date Range |
| FORM_ID_DATE_SUBMIT | 2775 | same report — date-range form |
| FORM_ID_REPORT | 2776 | same report — resulting summary |
| DATE_FIELD_START | 5697516 | same report — start-date field |
| DATE_FIELD_END | 5697616 | same report — end-date field |
| ROSTER_MENU_ITEM_ID | 45897 | Export Roster to Excel |

### If a Known site-wide value doesn't match your site

1. Open your browser's DevTools → Network tab, and make sure it's
   recording.
2. Navigate to the relevant report (see the menu paths above), submit
   a date range if asked, and click **Open in Excel.**
3. For the Event Participation report: find the **POST to
   `FormDetail.aspx`** and check its `Menu_Item_ID`, `Form_ID`, and
   the `ENTRY...` field names for your start/end dates against
   `MENU_ITEM_ID`, `FORM_ID_DATE_SUBMIT`, `DATE_FIELD_START`, and
   `DATE_FIELD_END`. Then find the **GET to
   `FormReportMultiSection.aspx`** and check its `Form_ID` against
   `FORM_ID_REPORT`.
4. For the roster export: check the `Menu_Item_ID` in the
   `FormReport.aspx` URL against `ROSTER_MENU_ITEM_ID`.


If live data doesn't load, that's the first thing
to check — see Troubleshooting  for how to verify these on
your own site.

For reference, the two reports these power are always in the same
place in TroopWebHost's menus:

- **Menu > Calendar > Event Reports > Event Participation Summary for
  Date Range**
- **Menu > Membership > Export Membership Data > Export Roster to
  Excel** (not the Active-only version — you want the one that
  includes everyone)

⚠️ **The roster export contains sensitive personal information** —
addresses, medical details, driver's license numbers, etc. Make sure
whoever has access to it on your site is appropriately restricted
(normally just troop leadership). The code only ever extracts name +
a few numeric totals from it, and only pulls it at all when someone
with the right tasks (View Membership Information, Web Page Editor)
loads the page — but the underlying report access itself should stay
tightly controlled on your end regardless.
