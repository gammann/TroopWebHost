# Changelog

## Unreleased

- Verified `TWH_CONFIG`'s Menu_Item_ID/Form_ID values (both leader-side and
  self-service) against HAR captures from two additional, unrelated troop
  sites. Every value matched exactly, including individual `ENTRY###` field
  IDs on the profile page - suggesting these are fixed across TroopWebHost
  installations rather than per-troop custom values. SETUP.md softened
  accordingly: verify-if-something-breaks instead of find-your-own-IDs-first
- Renamed the page heading from "Eagle Scout Application Filler" to "Eagle
  Scout Rank Application Form"
- Fixed: "Date joined Scouts BSA" wasn't filled in on the parent/Scout
  self-service path. Confirmed the field ID (`ENTRY312316`, labeled "Date
  Joined Unit" on that page) via HAR capture and wired it up directly
- Fixed: the parent/guardian reference block was silently filled with the
  Scout's own email and phone number instead of the parent's. Since no
  actual parent contact info is captured anywhere, those two fields are now
  deliberately left blank (with a review-step reminder) rather than
  populated with wrong data
- Fixed: Order of the Arrow positions other than "OA Troop Representative"
  (e.g. Vice Chief, Chapter Chief) were being offered as if they qualified
  toward the Eagle position-of-responsibility requirement. Only the
  Representative role is now treated as qualifying
- Fixed: positions of responsibility were pre-selected by most-recent-first,
  rather than the earliest ones after the Life board of review that
  actually satisfy the 6-month requirement. Selection is now chronological,
  accumulating served time until 6 months is reached (capped at 2, matching
  the form's two Position rows)
- Fixed: a parent/Scout login with no access to the leader-only Advancement
  Hub page could hang indefinitely on "Looking up available Scout(s)..."
  with no error. Every TroopWebHost request now has a 15-second timeout,
  and `[Eagle tool]` console breadcrumbs were added throughout the roster
  lookup path for easier diagnosis
- Fixed: several header/card colors (subtitle text, step-pill text, input
  borders, method-info box background) were hardcoded to this troop's
  specific green theme instead of tracking the site's live-detected colors.
  These now derive from the same CSS variables the rest of the page already
  uses, so the page adapts automatically if TroopWebHost's color scheme
  ever changes
