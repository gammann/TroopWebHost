# TroopWebHost
Code to enhance TroopWebHost


## Disclaimer

This is an **unofficial, community-built tool** with no affiliation
to, endorsement by, or support from TroopWebHost. It works by
replicating a handful of TroopWebHost's own internal web requests
(the same ones your browser makes when you click "Open in Excel" or
save a Custom Page) — these are not a published or supported API, and
TroopWebHost could change them at any time without notice, which may
break this tool.

You're responsible for confirming this complies with TroopWebHost's
Terms of Service for your own site before deploying it. Use at your
own risk. No warranty of any kind — see [`LICENSE`](./LICENSE).

The admin-publishing feature reads TroopWebHost's roster export,
which contains sensitive personal information (addresses, medical
details, etc.). Only the minimum data needed (names and numeric
totals) is ever extracted from it, and only when explicitly triggered
by someone who already has legitimate access to that report — but you
should still make sure access to that underlying report is
appropriately restricted on your own site.

## License

MIT — see [`LICENSE`](./LICENSE).
