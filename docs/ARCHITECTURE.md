# WtReps — Architecture

## 1. Purpose

This document defines the Version 1 technical architecture for WtReps.

WtReps Version 1 is intentionally simple:

- client-side only,
- local-first,
- offline-capable,
- no backend,
- no authentication,
- no cloud sync.

The architecture should optimize for:

- reliability during workouts,
- maintainability,
- small implementation surface,
- clean separation of concerns,
- future extensibility without speculative infrastructure.

---

# 2. Version 1 Technology Stack

Use:

- Svelte 5
- SvelteKit 3
- TypeScript
- Vite
- Dexie
- IndexedDB
- `@vite-pwa/sveltekit`
- Zod
- Vitest
- Netlify

Do not introduce:

- Supabase
- PostgreSQL
- AWS services
- Cloudflare Workers
- Firebase
- backend APIs
- server-side persistence
- user authentication
- cloud synchronization

unless the architecture documentation is explicitly revised later.

---

# 3. High-Level Architecture

WtReps Version 1 is a browser application with a local database.

```text
┌─────────────────────────────────────┐
│              WtReps PWA             │
│                                     │
│  Svelte UI                          │
│       ↓                             │
│  Application / Domain Services      │
│       ↓                             │
│  Repository Layer                   │
│       ↓                             │
│  Dexie                              │
│       ↓                             │
│  IndexedDB                          │
└─────────────────────────────────────┘

             ↓ static build

           Netlify
             ↓
         wtreps.com
```

The browser is the entire runtime environment.

There is no application server in Version 1.

---

# 4. Architectural Principle

The local IndexedDB database is the persistent source of truth.

The application should behave like this:

```text
User action
    ↓
Application service
    ↓
Repository
    ↓
Dexie
    ↓
IndexedDB
    ↓
UI reacts to persisted state
```

The application should not maintain a second persistent source of truth in a global in-memory store.

Transient UI state may live in Svelte state.

Persistent domain state belongs in IndexedDB.

---

# 5. SvelteKit Usage

Use SvelteKit as the application framework.

WtReps should be configured as a static client-side application suitable for Netlify hosting.

Use SvelteKit for:

- routing,
- application shell,
- layout,
- component organization,
- build tooling,
- static deployment.

WtReps does not require:

- server-side rendering,
- server load functions,
- server endpoints,
- server actions,
- server-side database access.

Avoid introducing server-only code unless the architecture changes later.

---

# 6. Rendering Strategy

WtReps is primarily a client-side application.

Because IndexedDB only exists in the browser, application data access should happen client-side.

Routes should be written with this assumption.

Avoid architecture that depends on server-rendered domain data.

Static rendering may still be used for the application shell where appropriate.

---

# 7. Static Deployment

Use the SvelteKit static adapter.

The production build should produce static assets that Netlify can serve directly.

Netlify responsibilities are limited to:

- static hosting,
- HTTPS,
- custom domain,
- deployment,
- preview deployments.

WtReps should not depend on Netlify Functions in Version 1.

---

# 8. PWA Architecture

WtReps must be installable as a Progressive Web App.

Use:

```text
@vite-pwa/sveltekit
```

for:

- web app manifest,
- service worker generation,
- precaching,
- offline application shell,
- installability.

The service worker should focus on application assets.

Workout data belongs in IndexedDB, not in the service-worker cache.

---

# 9. Offline Behavior

After the application has been loaded and cached, WtReps should function without Internet access.

Offline operation must include:

- launching the app,
- creating and editing Exercises,
- creating and editing Circuits,
- starting Workouts,
- recording Sets,
- navigating between Exercises,
- ending Workouts,
- viewing history,
- exporting data.

No normal workout action should require a network request.

---

# 10. Service Worker Scope

The service worker should cache:

- HTML shell,
- JavaScript bundles,
- CSS,
- icons,
- manifest,
- local fonts if used,
- other static assets required for launch.

The service worker should not be used as the primary data store.

Do not duplicate IndexedDB data into Cache Storage.

---

# 11. Application Updates

A new application version should not interrupt an active Workout.

If a new service worker is available while a Workout is active:

- do not force reload,
- allow the user to continue the Workout,
- defer activation or user-triggered reload until the Workout ends.

A future UI may display:

```text
Update available
```

without disrupting the current session.

---

# 12. Local Persistence

Use IndexedDB for all persistent application data.

Use Dexie as the IndexedDB abstraction.

Do not use:

- LocalStorage for domain data,
- SessionStorage for domain data,
- browser cache as domain storage.

LocalStorage may be used only for tiny non-critical preferences if absolutely necessary, but Dexie should remain the default persistent storage mechanism.

---

# 13. Dexie Responsibilities

Dexie should provide:

- database definition,
- schema versioning,
- indexes,
- transactions,
- typed table access,
- database migrations.

The database name should remain stable:

```text
WtReps
```

Changing the database name after release may make existing user data appear lost and should therefore be avoided.

---

# 14. Database Module

Keep Dexie configuration centralized.

Suggested location:

```text
src/lib/data/db.ts
```

Responsibilities:

- create the Dexie database instance,
- define tables,
- define indexes,
- define schema versions,
- initialize default AppSettings if necessary.

There should normally be one database instance for the application.

---

# 15. Domain Layer

Domain types should live separately from persistence implementation.

Suggested structure:

```text
src/lib/domain/
├── exercise.ts
├── circuit.ts
├── workout.ts
└── settings.ts
```

These modules should define types such as:

```text
Exercise
ExerciseSetting
Circuit
CircuitExercise
Workout
WorkoutExercise
WorkoutExerciseSetting
WorkoutSet
AppSettings
WeightUnit
WorkoutStatus
```

The domain layer should not depend heavily on Svelte components.

---

# 16. Repository Layer

Svelte components should not contain direct persistence logic for substantial operations.

Use repository modules.

Suggested structure:

```text
src/lib/data/repositories/
├── exerciseRepository.ts
├── circuitRepository.ts
├── workoutRepository.ts
└── settingsRepository.ts
```

Repositories should handle data access such as:

```text
getExercise()
listExercises()
createExercise()
updateExercise()
deleteExercise()
```

and:

```text
getCircuit()
listCircuits()
saveCircuit()
deleteCircuit()
```

and:

```text
getActiveWorkout()
getWorkoutHistory()
getExerciseHistory()
```

Repositories should remain focused on persistence concerns.

---

# 17. Application Services

Use application/domain services for operations involving multiple records or business rules.

Suggested structure:

```text
src/lib/services/
├── startWorkout.ts
├── completeWorkout.ts
├── abandonWorkout.ts
├── exportData.ts
├── importData.ts
└── storagePersistence.ts
```

Possible future additions:

```text
completeSet.ts
reorderCircuit.ts
```

if they contain meaningful business logic.

---

# 18. Why Use Services

Some operations are too important to distribute across UI components.

For example:

```text
Start Workout
```

must:

1. load the Circuit,
2. load ordered CircuitExercises,
3. load Exercises,
4. snapshot Exercise names,
5. snapshot notes,
6. snapshot machine settings,
7. resolve weight units,
8. find previous completed Sets,
9. create suggested WorkoutSets,
10. create the Workout and all child records atomically.

This should be implemented once in a service, not repeated in route/component code.

---

# 19. Transaction Boundaries

Use Dexie transactions for multi-record operations.

Important transactional operations include:

- create Exercise with settings,
- update Exercise with settings,
- delete Exercise and related template records,
- save Circuit membership and order,
- start Workout,
- complete Workout,
- abandon Workout cleanup,
- delete Workout,
- JSON import.

The application should avoid partially written domain state.

---

# 20. Suggested Source Structure

Recommended initial structure:

```text
src/
├── lib/
│   ├── components/
│   │
│   ├── domain/
│   │   ├── exercise.ts
│   │   ├── circuit.ts
│   │   ├── workout.ts
│   │   └── settings.ts
│   │
│   ├── data/
│   │   ├── db.ts
│   │   ├── schema.ts
│   │   └── repositories/
│   │       ├── exerciseRepository.ts
│   │       ├── circuitRepository.ts
│   │       ├── workoutRepository.ts
│   │       └── settingsRepository.ts
│   │
│   ├── services/
│   │   ├── startWorkout.ts
│   │   ├── completeWorkout.ts
│   │   ├── abandonWorkout.ts
│   │   ├── exportData.ts
│   │   ├── importData.ts
│   │   └── storagePersistence.ts
│   │
│   ├── validation/
│   │   └── exportSchema.ts
│   │
│   └── utils/
│
├── routes/
│
└── app.html
```

This structure may evolve as the application grows.

Do not create unnecessary folders before they are useful.

---

# 21. Routing

Suggested route structure:

```text
/
```

Home / Circuit selection.

```text
/exercises
```

Exercise management.

```text
/exercises/[id]
```

Exercise editor.

```text
/circuits
```

Circuit management.

```text
/circuits/[id]
```

Circuit editor.

```text
/workout/[id]
```

Active Workout.

```text
/history
```

Workout history.

```text
/history/[id]
```

Workout detail.

```text
/settings
```

Application settings, import, export.

Exact routes may change during UI design.

---

# 22. Home Route

The home route should primarily answer:

```text
What workout do I want to start?
```

It should show:

- available Circuits,
- Start Workout actions,
- active Workout resume state if one exists.

Administrative actions should be secondary.

---

# 23. Active Workout Route

The active Workout route is the most important screen in the application.

It should prioritize:

- current Exercise,
- machine settings,
- previous performance,
- current Sets,
- large controls,
- next/previous Exercise navigation.

Avoid showing unrelated management UI while a Workout is active.

---

# 24. Svelte State

Use Svelte's built-in reactivity for transient UI state.

Examples:

- open dialogs,
- selected tabs,
- form field state,
- swipe state,
- temporary messages.

Do not introduce Redux-like global state management in Version 1.

Do not add Zustand or another store library unless a concrete need appears.

---

# 25. Persistent Reactive Data

Dexie may be integrated with Svelte reactivity where useful.

Use Dexie live queries or repository-level reactive wrappers for screens that should automatically update when persisted data changes.

Avoid duplicating entire database collections into long-lived global stores.

---

# 26. Forms

Forms should generally:

1. load persisted data,
2. create temporary editable form state,
3. validate,
4. save through a repository or service,
5. persist through Dexie.

Avoid writing to IndexedDB on every keystroke for infrequently edited configuration forms unless there is a clear benefit.

The active Workout is different: workout changes should persist immediately.

---

# 27. Active Workout Persistence

Set entry writes each valid numeric input change immediately through focused
services, with no debounce/unload timer. Local input strings preserve temporary
empty/decimal editing. Completion submits final values in one transaction. Completed
Set edits retain completion and save valid values immediately; Done Editing collapses
the card without changing completion status. Services reject edits after workout end.

Previous performance returns the historical WorkoutExercise and completed Sets.
Matching units copy weight/reps; mismatches copy reps with null weight. Last Time
keeps the historical unit. Version 1 performs no automatic unit conversion.

Workout `currentExercisePosition` stores the snapshot position. Dexie version 2
backfills existing Workouts without changing snapshots. Navigation, first-Set creation,
Set reordering after deletion, and ending Workouts use transactions. Summary counts
and duration are derived. No global store or server is involved.

During a Workout, edits should be persisted aggressively.

Examples:

- weight change,
- rep change,
- Set completion,
- Add Set,
- Delete Set,
- End Workout.

The goal is that closing the PWA at almost any moment should lose little or no Workout progress.

---

# 28. Resume Behavior

On application startup:

1. open IndexedDB,
2. check for a Workout with:

```text
status = "in_progress"
```

3. if one exists, make Resume Workout prominent.

The app should not depend on in-memory state to know whether a Workout is active.

---

# 29. Storage Persistence

Because Version 1 has no backend backup, WtReps should request persistent browser storage where supported.

Use a small service:

```text
src/lib/services/storagePersistence.ts
```

It may use:

```text
navigator.storage.persisted()
navigator.storage.persist()
```

when supported.

The application must still assume local browser data can potentially be lost.

JSON export remains the backup mechanism.

---

# 30. JSON Export Architecture

JSON export should read directly from IndexedDB.

Flow:

```text
IndexedDB
    ↓
Export Service
    ↓
Serializable export object
    ↓
JSON validation / formatting
    ↓
browser download/share
```

Export must not depend on Internet connectivity.

---

# 31. JSON Import Architecture

JSON import should use:

- JSON parsing,
- Zod validation,
- schema-version validation,
- referential validation,
- a single Dexie transaction.

Flow:

```text
JSON file
    ↓
parse
    ↓
Zod validate
    ↓
schema version check
    ↓
reference validation
    ↓
Dexie transaction
    ↓
replace existing data
```

If validation fails, existing data must remain unchanged.

---

# 32. Zod Usage

Use Zod primarily for:

- JSON import validation,
- export schema validation,
- boundary validation where persisted external data enters the app.

Do not overuse Zod for every internal function if TypeScript types are sufficient.

---

# 33. UUID Generation

Use browser-native UUID generation where available:

```text
crypto.randomUUID()
```

Avoid adding a UUID dependency unless necessary.

---

# 34. Date Handling

Store timestamps as UTC ISO strings.

Example:

```text
2026-10-19T02:40:00.000Z
```

Create them with standard JavaScript Date APIs.

Convert to local time only for display.

Do not store localized date strings in persistent records.

---

# 35. Styling Approach

WtReps should favor simple maintainable CSS.

A heavy UI framework is not required.

Preferred approach:

- component-scoped Svelte CSS,
- shared CSS variables/tokens,
- global base styles.

A lightweight utility library may be introduced later only if it materially improves development.

Avoid making Version 1 dependent on a large component framework.

---

# 36. Design Tokens

Use CSS custom properties for common design values.

Examples:

```text
--font-size-body
--font-size-large
--font-size-exercise-title
--font-size-workout-number
--touch-target-min
--space-sm
--space-md
--space-lg
--radius-md
```

This will make the large-text workout interface easier to tune consistently.

---

# 37. Typography

The active Workout UI should prioritize readability.

Important numeric values may use approximately:

```text
32–48px
```

equivalent sizing.

Exercise titles may use approximately:

```text
28–32px
```

Supporting text should generally avoid very small sizes.

Exact values belong in UI design rather than architecture.

---

# 38. Touch Targets

Important interactive controls should generally provide at least:

```text
44–48px
```

of usable touch area.

This is especially important for:

- Set completion,
- Add Set,
- Previous,
- Next,
- End Workout.

---

# 39. Mobile-First Layout

Design the smallest supported mobile layout first.

Desktop should enhance the layout rather than define it.

Do not create desktop-only interaction patterns that become awkward on an iPhone.

---

# 40. Swipe Navigation

Swipe navigation may be added to the active Workout screen.

It must remain secondary to visible Previous and Next controls.

Gesture logic should be isolated from domain logic.

Do not persist gesture state.

---

# 41. Testing Strategy

Prioritize tests around domain and persistence behavior.

The most important tests are not visual snapshot tests.

Test:

- database initialization,
- default AppSettings creation,
- Exercise creation,
- ExerciseSetting persistence,
- Circuit ordering,
- start Workout snapshot behavior,
- previous Set suggestion behavior,
- Set completion,
- Add Set defaults,
- Workout completion cleanup,
- Workout deletion,
- Exercise deletion without historical loss,
- Circuit deletion without historical loss,
- JSON export,
- JSON import,
- database migrations.

---

# 42. Test Framework

Use Vitest.

Tests should be fast enough to run frequently during development.

Use an IndexedDB-compatible test environment or mock implementation where appropriate.

Avoid tests that depend on real browser persistence state.

---

# 43. UI Tests

Version 1 may add component tests for critical interactions.

High-value examples:

- marking a Set complete,
- adding a Set,
- moving to the next Exercise,
- resuming a Workout.

End-to-end testing may be added later.

Do not overbuild the initial test suite before core functionality exists.

---

# 44. Build Validation

After substantial changes, run:

- type checking,
- linting if configured,
- tests,
- production build.

Codex should not consider a task complete if the project does not build.

---

# 45. Error Handling

Errors during normal Workout persistence should be surfaced clearly because local persistence is critical.

The application should distinguish:

- recoverable validation errors,
- IndexedDB failures,
- import validation failures,
- unsupported browser features.

Avoid silently swallowing database errors.

---

# 46. Browser Compatibility

Primary target:

- current iPhone Safari / installed PWA.

Secondary target:

- current desktop Chrome,
- current desktop Safari,
- current Firefox where practical.

The application should avoid unnecessary experimental APIs.

Progressive enhancement is preferred for optional browser features.

---

# 47. Network Independence

Application code should not introduce runtime network dependencies for normal functionality.

Avoid:

- remote configuration,
- remote fonts required for rendering,
- third-party APIs required at runtime,
- CDN-only critical assets.

Critical assets should ship with the app where practical.

---

# 48. Fonts

Prefer system fonts in Version 1.

Benefits:

- no network dependency,
- faster startup,
- good iOS rendering,
- smaller application bundle.

A custom font may be added later if design requirements justify it.

---

# 49. Security

Version 1 stores only local workout data.

There is no account or backend security boundary.

Still:

- avoid unsafe HTML injection,
- validate imported JSON,
- do not execute imported content,
- treat imported strings as data only.

Exercise notes and setting labels must be rendered safely.

---

# 50. Privacy

Workout data remains on the user's device unless they explicitly export a JSON file.

Version 1 should not transmit Workout data to a backend.

Analytics should not be added casually.

If analytics are introduced later, they should be reviewed separately for privacy impact.

---

# 51. Performance

Normal interactions should feel immediate.

Particularly:

- marking a Set complete,
- editing reps,
- editing weight,
- moving between Exercises,
- adding Sets.

These operations should not involve expensive full-database reloads if targeted queries will suffice.

---

# 52. Avoid Premature Optimization

Expected data volume is small.

Even several years of workouts should remain modest.

Do not introduce:

- complex caching layers,
- background workers,
- pagination infrastructure,
- custom query engines

until actual performance data justifies them.

---

# 53. Avoid Premature Backend Abstractions

Version 1 has no backend.

Do not create:

```text
CloudRepository
SyncService
ApiClient
AuthService
DeviceService
```

as placeholders.

If cloud synchronization is added later, introduce those abstractions at that time.

Do not burden Version 1 with speculative code.

---

# 54. Future Backend Compatibility

Although Version 1 is local-only, a future backend should remain possible.

The following current decisions help preserve that option naturally:

- UUID IDs,
- explicit timestamps,
- normalized entities,
- historical snapshots,
- repository separation,
- JSON portability.

No additional backend-specific code is required now.

---

# 55. Netlify Deployment

Production hosting:

```text
https://wtreps.com
```

Netlify should deploy the static SvelteKit build.

Expected deployment flow:

```text
Git repository
    ↓
Netlify build
    ↓
SvelteKit static output
    ↓
Netlify CDN
    ↓
wtreps.com
```

---

# 56. Environment Variables

Version 1 should require little or no runtime configuration.

There should be no secrets.

Avoid creating `.env` requirements unless a real need appears.

---

# 57. Repository Philosophy

Keep the repository understandable to one developer.

Prefer:

- direct code,
- clear naming,
- small modules,
- explicit business logic,
- useful tests.

Avoid:

- unnecessary dependency injection frameworks,
- excessive generic abstractions,
- elaborate event buses,
- micro-frontends,
- monorepo complexity.

WtReps Version 1 is a small focused application.

Its architecture should reflect that.

---

# 58. Architectural Decision Summary

WtReps Version 1 uses:

```text
SvelteKit 3
Svelte 5
TypeScript
```

for the application.

```text
Dexie
IndexedDB
```

for persistent local data.

```text
@vite-pwa/sveltekit
```

for installability and offline application assets.

```text
Zod
```

for import/export boundary validation.

```text
Vitest
```

for automated testing.

```text
Netlify
```

for static hosting.

There is:

```text
no backend
no authentication
no cloud synchronization
no API
no server database
```

The core architectural rule is:

> Keep the workout experience local, fast, persistent, and simple.
