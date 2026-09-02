# Setup guide

This tool installs as a **TroopWebHost Custom Page**. There's no server, no
build step, and nothing to host separately - the whole thing is one HTML
file that runs inside TroopWebHost itself.

## 1. Create the custom page

1. In TroopWebHost, go to your site admin area and create a new Custom Page
   (or open an existing one you want to use for this).
2. Open the page's HTML/source editor.
3. Copy the entire contents of `eagle-scout-rank-application-form.html` and
   paste it in as the page body.
4. Save.

## 2. Check your troop's menu IDs

Near the bottom of the script is a config block:

```js
const TWH_CONFIG = {
  rosterUrl: 'formCustom.aspx?Menu_Item_ID=56926&Stack=0',
  myScoutsUrl: 'FormList.aspx?Menu_Item_ID=45899&Stack=1',
  profileUrl: id => `FormDetail.aspx?Menu_Item_ID=56934&ID=${id}&FK=${id}&Form_ID=110&Stack=2`,
  rankPositionUrl: id => `FormDetail.aspx?Menu_Item_ID=56926&ID=${id}&FK=${id}&Form_ID=190&Stack=2`,
  meritBadgeUrl: id => `FormDetail.aspx?Menu_Item_ID=56926&ID=${id}&FK=${id}&Form_ID=228&Stack=2`,
  eagleReqUrl: id => `FormDetail.aspx?Menu_Item_ID=56926&Form_ID=213&Stack=2&ID=${id}&FK=0`,
  selfProfileUrl: id => `FormDetail.aspx?Menu_Item_ID=45899&Form_ID=209&FK=0&ID=${id}&Stack=2`,
  selfRankPositionUrl: id => `FormDetail.aspx?Menu_Item_ID=45899&Form_ID=432&FK=0&ID=${id}&Stack=2`,
  selfMeritBadgeUrl: id => `FormDetail.aspx?Menu_Item_ID=45899&Form_ID=425&FK=0&ID=${id}&Stack=2`,
  selfEagleReqUrl: id => `FormDetail.aspx?Menu_Item_ID=45899&Form_ID=427&FK=0&ID=${id}&Stack=2`,
};
```

**These are believed to work unmodified on most TroopWebHost sites.** Every
value above - both the leader-side and self-service IDs - has been checked
against HAR captures from three different troop sites (including this
tool's own) and matched exactly every time, down to the individual
`ENTRY###` field IDs inside each page. That suggests TroopWebHost provisions
the Advancement Hub, Membership Hub, and My Scouts pages identically across
installations, rather than each troop getting its own numbering. This isn't
a guarantee for every possible TWH configuration, so it's still worth
verifying against your own site before relying on it - but you likely won't
need to change anything here.

### If something doesn't match on your site

1. Log into TroopWebHost as a leader with Advancement Hub access.
2. Open your browser's DevTools (F12) -> Network tab, and leave it recording.
3. Click through to the page in question:
   - **Advancement Hub landing page** -> note the URL's `Menu_Item_ID`
   - **A Scout's rank/position history** -> note `Menu_Item_ID` and `Form_ID`
   - **A Scout's merit badge history** -> same
   - **The Eagle requirement checklist** -> same
4. Repeat while logged in as (or impersonating) a parent/Scout account to
   get the self-service equivalents under "My Scouts."
5. Update each corresponding line in `TWH_CONFIG`.

If you get stuck, exporting a HAR file (DevTools -> Network tab -> right
click -> "Save all as HAR") while you click through the pages you need, and
searching it for `Menu_Item_ID=` and `Form_ID=`, is the most reliable way to
confirm exact values - this is how the defaults in this repo were found and
cross-checked.

## 3. Set the application form source

At the top of the page is an "Application form source" field where you set
the URL the tool downloads the blank 512-728 PDF from before filling it in.
Point this at wherever your troop keeps the current official form (council
site, national BSA site, or your own hosted copy) so it always fills the
latest version rather than a version baked into this file.

## 4. Test it

1. **As a leader**: open the page, search for a Life or Eagle rank Scout,
   step through all 5 steps, and confirm the downloaded PDF looks right.
2. **As a parent/Scout**: open the page while logged in as a parent or Scout
   account. It should fall back to the "My Scouts" list automatically. If
   nothing loads, open DevTools -> Console and look for `[Eagle tool]` log
   lines - they'll show which request failed or timed out.
3. Try a Scout who isn't yet Life rank to confirm the tool fails gracefully
   with a clear message rather than a blank/stuck screen.

## Updating field mappings if TroopWebHost changes its layout

If TroopWebHost ever restructures a page (renumbers an `ENTRY###` field,
changes a table's headers, etc.), the corresponding extraction function will
start silently returning blank data. Open DevTools -> Console while running
the tool; the `[Eagle tool]` debug/warn log lines note which page loaded,
how many rows/tables were found, and whether an expected header pattern was
matched, which is usually enough to localize the fix to one function.
