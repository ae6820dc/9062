# Unicode Translate 2 validation

Location: `translate/2/`. The original `translate/1/` project is unchanged.

Twelve sample launchers have 24 new, distinct permanent Program IDs and Storage Keys recorded in `identities.json`. The checked-in generator reproduces them. Every original base dictionary blob and original source/license notice is preserved.

The original 16 browser integration groups remain in `tests/browser.cjs`, including all 72 directions, Unicode, favorites/history, export, interrupted and complete downloads, offline launch and corrupt-shard rejection. `tests/personal.cjs` adds twelve-sample identity/isolation checks, personal expression creation/edit/delete, reverse multilingual searches, Unicode normalization, source copying, validated atomic import with conflict policies, export round trips, offline access and responsive layout screenshots. `tests/pages.cjs` verifies the deployed application bytes for every sample and runs both browser suites against the live Pages origin. Evidence is uploaded by the dedicated Translate 2 workflow. Screenshots and result files are test artifacts, not dictionary inputs.

The full corpus validation was completed for the unchanged base dataset during Translate 1. For Translate 2, Git blob equality verifies that no dictionary shard, source snapshot, manifest or original notice changed. Sample equivalence and all local HTML links are checked separately.

Personal entries are device-local IndexedDB records, separately namespaced per sample. No server sync is provided. Browser site-data deletion can remove them; export/import is the portable backup. Import is bounded to 10 MB and 10,000 entries; errors abort the transaction. Browser verification uses Chromium; other browser engines are not field-tested here.
