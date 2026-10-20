# WtReps

Mobile-first, local-first workout tracking for selectorized weight-training machines.
Version 1 runs entirely in the browser. IndexedDB through Dexie is the source of truth;
there are no accounts, backend APIs, or synchronization.

## Development

Use Node **22.23.3** (see `.nvmrc`; SvelteKit 3 requires at least 22.17).

```sh
npm ci
npm run dev
```

```sh
npm run check       # Strict TypeScript and Svelte diagnostics
npm run lint        # Prettier formatting checks
npm test           # Vitest persistence tests with isolated fake IndexedDB databases
npm run build      # Static application and generated service worker in build/
npm run verify     # Formatting, type checks, unit tests, and production build
npm run preview    # Preview the production build
```

Production offline smoke test:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

Alternatively set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed Chromium executable.
The browser test uses a mobile viewport and verifies real IndexedDB initialization,
manifest icons, offline navigation, deep links, and reopening the shell offline.
It is not a substitute for testing installation on a physical iPhone.

## Source structure

- `src/routes/`: Home, Exercise and Circuit list/create/edit routes, Manage entry point,
  `/workout/[id]` Set entry, Workout Summary, Workout/Exercise History, and Settings/backup.
- `src/lib/components/`: shared presentation.
- `src/lib/domain/`: typed templates, historical snapshots, settings, and shared types.
- `src/lib/data/`: versioned Dexie schema, initialization, repositories, and persistence tests.
- `src/lib/services/`: initialization, workout snapshot creation/abandonment, and storage requests.
- `src/lib/validation/`: Zod boundary validation foundation.
- `src/lib/utils/`: UUID and UTC timestamp creation.
- `static/`: local icons; no remote fonts or runtime APIs.
- `docs/`: source-of-truth product, data, architecture, and UI documents.

Exercise and Circuit Management support local creation, editing, and deletion,
including machine settings, ordered membership, and relationship cleanup. Workouts can be
started, resumed at the exact Exercise, recorded, completed, abandoned, reviewed,
and corrected. Settings includes local JSON backup/restore. Empty notes/descriptions
use empty strings; absent overrides, completion times, and export times use `null`.
`AppSettings` uses the documented singleton ID `app-settings`; other records use UUIDs.

## Static deployment and offline behavior

Netlify runs `npm run verify` and publishes `build/` using `netlify.toml`.
The static adapter produces `200.html`; Netlify rewrites route requests to that shell.
`npm run preview` serves these final static files with the same fallback rather than
SvelteKit's intermediate preview output, so the generated service worker is available.
SSR is disabled, and database access starts after mounting in the browser.
SvelteKit still creates intermediate build-time server bundles; these are not deployed.

The service worker precaches the shell, all route bundles, CSS, manifest, and icons.
The first visit requires connectivity; offline launch works after successful caching.
Only application assets enter Cache Storage. Domain records remain in IndexedDB.
Updates wait rather than force-reloading an open application. A user-controlled update
flow that checks active workouts belongs in subsequent feature development.

### Deploy to Netlify

1. Commit and push the repository, including `package-lock.json`, `.nvmrc`, and
   `netlify.toml`. Connect that Git repository to a Netlify project.
2. Use the repository root as the base directory, `npm run verify` as the build
   command, and `build` as the publish directory. The committed configuration pins
   Node 22.23.3 and includes development dependencies needed by the build checks.
3. No environment secrets, Functions, Edge Functions, database, or additional
   framework adapter are needed. Keep the existing static adapter configuration.
4. Deploy, then open the HTTPS site and reload a deep link such as `/settings`.
   Confirm `/sw.js` returns JavaScript and `/manifest.webmanifest` returns the manifest.
5. Install/open on iPhone, wait for offline-ready feedback, then test offline
   reopening, Set entry/resume, and JSON download/file selection before regular use.

The SPA rewrite preserves existing static files. The service worker, HTML fallback,
and manifest revalidate; hashed assets can be cached immutably. `build/` is generated
and should not be committed. Netlify browser tests are separate from the build gate:
run `npm run test:e2e` locally against the production build before releasing.

Choose the final production origin before entering important data. Local data on
localhost, a deploy preview, a `netlify.app` address, and a custom domain is separate.
Use Export/Import to move data; changing the hosted URL does not migrate it.

Reference: [Netlify's static SvelteKit setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/sveltekit/),
[Node/dependency configuration](https://docs.netlify.com/build/configure-builds/manage-dependencies/),
and [SPA rewrite rules](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).

## Compatibility decisions and documentation discrepancies

- Documents were supplied at the repository root and moved unchanged into `docs/`.
- SvelteKit 3 configuration lives in `vite.config.ts`, imports use `#lib`, and
  TypeScript extends `$app/tsconfig`, following the current Kit 3 structure.
- `@vite-pwa/sveltekit` 1.1.0 declares Kit 1/2 peers and uses the older build lifecycle.
  A narrowly scoped npm peer override permits Kit 3. The static adapter wrapper calls
  the PWA plugin's public generation API **after** static output is written, ensuring
  `200.html` is precached. Unused HTML-transform plugins are excluded because Kit 3
  does not support that hook. Revisit this compatibility bridge when the plugin adds
  official Kit 3 support; rerun the offline browser test after upgrades.
- The data document suggests indexing boolean `WorkoutSet.isCompleted`, but IndexedDB
  keys cannot be booleans. The value remains boolean; filter sets loaded via
  `workoutExerciseId` instead. Other documented indexes are present; required compound
  uniqueness is enforced in the schema.
- JSON backups use the documented top-level collections without a `data` wrapper.
- Exercise settings save only when both trimmed label and value are non-empty.
  Incomplete rows stay in local form state and are omitted on save. Existing setting
  IDs and explicit positions are preserved; gaps are valid. New rows use the first
  available position, and settings are displayed in position order.

Exercise forms protect in-app navigation with Keep Editing / Discard confirmation.
Reloading or leaving the site uses native browser confirmation where supported;
mobile browsers cannot guarantee prompts when the operating system closes the app.
Saved Exercise editors link to Exercise History, including an empty-history state.
The browser suite covers offline creation/editing, validation, unsaved changes, and
Circuit-aware deletion; persistence tests also verify transaction rollback and that
all historical snapshots/settings/sets survive template deletion.

## Circuit editor decisions

The routes are `/circuits`, `/circuits/new`, and `/circuits/[id]`. The Exercise picker
is a full in-editor view rather than a separate `/add-exercise` route. The same
`CircuitEditor` component retains its local draft while showing the picker or the
existing `ExerciseEditor`. Save Exercise creates a normal Exercise and returns it to
the Circuit draft through a callback. No Circuit is persisted until Save Circuit;
no global, session-storage, or database draft store is used. A saved Exercise remains
in the library even if the Circuit draft is discarded. Reload/unload protection has
the same browser limitations as Exercise forms.

Move Up / Move Down controls change local array order immediately. The repository
derives sequential positions from that array, validates unique/existing Exercise IDs,
and saves Circuit and membership together. Surviving membership UUIDs and creation
timestamps are retained. Remove affects only membership when the Circuit is saved;
it never deletes an Exercise or historical Workout data.

Circuit deletion checks for an `in_progress` Workout inside the delete transaction
and refuses deletion if one uses the Circuit. Completed/abandoned Workouts and their
snapshots, settings, and sets are preserved. Manage counts use a repository live query.
Empty Circuits can be saved and display zero Exercises; Home prevents starting them.

Circuit tests cover ordering, duplicates, missing Exercises, failed-write rollback,
history preservation, and active-workout deletion protection. Mobile browser tests
cover offline create/reorder/remove, correct counts, nested Exercise creation,
unsaved-change protection, and empty Circuits. No new dependencies were added.

Future schema changes must add a new Dexie version and migrations. Template changes
must never rewrite historical snapshots. Multi-record changes require transactions.

## Workout lifecycle decisions

Home observes persisted Circuits and the active Workout through repository live queries.
`startWorkout` checks the Circuit, membership, preferences, and active-workout rule in
one read/write transaction, then creates the parent, ordered Exercise snapshots,
machine-setting snapshots, and suggested Sets. Every write commits together or rolls
back. Shared IndexedDB transaction scopes serialize concurrent starts across tabs;
disabled Start buttons provide additional UI protection.

Previous performance is matched by stable Exercise ID across all Circuits. Completed
Workouts are examined by completion time, newest first, until completed Sets exist.
Incomplete Sets and abandoned Workouts are excluded. Suggested Sets retain weight,
reps and relative order, with new IDs and incomplete status. Weight is copied only
when historical/current units match; otherwise suggested weight is null and reps are
copied. Last Time queries history separately and displays the historical unit.
Version 1 never converts weights automatically.

Resume is discovered from IndexedDB on every Home load and survives reload/offline
reopening after shell caching. `currentExercisePosition` persists the exact snapshot
position. Dexie version 2 backfills existing Workouts to their first snapshot position
and clamps invalid positions without rewriting snapshots/timestamps. Export format 2
documents the new field and is used by backup/restore. Abandon requires
confirmation, timestamps the retained Workout as abandoned, and atomically removes
only incomplete Sets. Completed Sets and all snapshots remain intact. Normal history
queries include completed Workouts only.

Lifecycle tests cover snapshot independence, cross-Circuit suggestions, transaction
rollback, concurrent starts, persistent discovery, and abandonment cleanup. Mobile
browser tests cover Start/Resume/Abandon, cross-tab updates, empty Circuits, reload,
and closing/reopening the active route offline. Physical iPhone installation remains
a manual validation step.

## Active Set entry

`ActiveWorkout` observes the current snapshot and history; `WorkoutSetCard` owns only
temporary input strings/edit state. `workoutEntry` services create the first empty
Set idempotently, update values, complete Sets, add/delete Sets, and move between
snapshots. `completeWorkout` atomically discards incomplete Sets and completes the
parent. The summary derives duration and counts only Exercises with completed Sets.

Valid numeric input changes are queued immediately in event order with no debounce.
There is no unload timer or separate Save button. Local strings allow decimal/empty
editing; service validation rejects negative/nonfinite weights and fractional reps.
In-app navigation, adding Sets, and ending the Workout await final input persistence.
Completion also validates/writes final values transactionally. Storage errors remain
visible with Retry. An OS/browser termination before a transaction commits can still
interrupt the latest write; no browser-only app can guarantee that final instant.

Editing completed Sets preserves completion and the original completion time. Valid
edits autosave; Done Editing collapses the card. Temporary invalid/empty completed
values remain local and block navigation until corrected. Delete is a secondary
text action, normalizing remaining positions transactionally. No gesture dependency
was added. Previous/Next use snapshot order; final Next becomes Finish, sharing the
explicit End Workout confirmation. The sticky footer does not change layout on input
blur, avoiding moving tap targets. View Workout opens the completed Workout Detail.

## Historical review and correction

Routes are `/history`, `/history/[id]`, `/history/[id]/edit`, and
`/exercises/[id]/history`. `historyRepository` queries completed parents and their
snapshot children; no current templates are needed. History lists newest completion
first with derived duration, completed Set count, and completed Exercise count.
Normal detail omits Exercises without completed Sets. Exercise History matches stable
Exercise IDs across Circuits, retains each snapshot's unit, and uses the latest
historical Exercise name as its heading. Rename/deletion does not change history.

`HistoricalWorkoutEditor` keeps a local draft until Save Workout. All existing
snapshot Exercises remain available to correct missing Sets, including skipped
Exercises. No new Exercise snapshot can be added. Labels/names/units are read-only;
machine-setting values may be corrected. Existing Sets keep IDs, creation times, and
completion timestamps. New Sets use the UTC Save time as their completion timestamp.
Removing Sets is local until Save; saved positions are normalized to 1..N. The Save
transaction restores the completed-only Set invariant, updates changed values and
Workout.updatedAt, and rejects stale drafts after another window saves corrections.
Set correction also updates subsequent Exercise History and Last Time queries.

Cancel/navigation uses Keep Editing / Discard confirmation for dirty drafts; native
unload prompts have the same browser limitations as existing editors. Delete Workout
requires confirmation and atomically deletes only the Workout and its snapshot
children. Circuits, Exercises, and template settings remain intact. History uses
standard bottom navigation; detail/edit use focused layouts. No schema changes or
dependencies were needed. Tests cover snapshot isolation, rollback, stale drafts,
corrections, deletion cascades, mixed units, and offline browser flows.

## Settings, backups and storage

Settings persists the default weight unit immediately without rewriting Exercise
overrides or existing snapshots. About reads the version from package.json. The
optional rest timer and Clear All Data control remain omitted.

`exportData` snapshots all nine application tables in one readonly transaction.
The shared Zod validator checks the complete Version 2 envelope before the browser
offers a JSON Blob download. The filename uses the local calendar date. IDs,
timestamps, snapshots, nulls, all Workout statuses and resume position are preserved.
`lastExportAt` changes only after download initiation; the file retains the prior
timestamp. Temporary URLs are revoked after 60 seconds (or immediately on initiation
failure). Browser download initiation cannot verify that the user ultimately saved
the file. Installed iPhone/PWA file handling remains a release check.

`importData` accepts Version 2 only, validates before confirmation and again at the
write boundary, then clears/inserts all tables in one replace-all transaction.
Version 1 is unsupported; newer versions show update guidance. Required field types,
UTC timestamps, UUIDs, singleton settings ID, unique IDs/positions/membership,
ownership references, units/statuses and one-active-Workout/resume rules are checked.
Historical source template references may be missing. Valid position gaps are kept.
Any insertion failure rolls back clears and writes. Settings and other repository
live queries observe only the committed authoritative replacement; imported active
Workouts are discovered normally from Home. No merge/cache/global store is involved.

Persistent storage is checked on Settings initialization and requested only by an
explicit button. There is no automatic repeat prompt. Denial/API errors are nonfatal;
the status remains friendly, and JSON backups remain the protection mechanism.
Unit tests cover validation, snapshot consistency, exact restoration, rollback,
download URL cleanup and storage outcomes. Mobile Chrome tests inspect a real JSON
download and exercise offline restore, invalid/cancelled imports and exact resume.
