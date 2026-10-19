# WtReps Development Instructions

WtReps is a mobile-first, local-first PWA for recording machine-based strength workouts.

## Sources of truth

Before making substantial changes, read the relevant files under `/docs`:

- `docs/REQUIREMENTS.md` — product behavior and scope
- `docs/DATA_MODEL.md` — persistent domain model
- `docs/ARCHITECTURE.md` — application architecture
- `docs/UI_NOTES.md` — UI/UX decisions when present

If implementation and documentation disagree, flag the discrepancy rather than silently changing the intended behavior.

## Version 1 constraints

WtReps v1 is entirely client-side.

Use:

- SvelteKit 3
- Svelte 5
- TypeScript
- Dexie
- IndexedDB
- `@vite-pwa/sveltekit`
- static deployment to Netlify

Do not introduce:

- a backend
- authentication
- cloud synchronization
- Supabase
- PostgreSQL
- AWS services
- Cloudflare Workers
- Firebase

unless the project documentation is explicitly changed later.

## Architecture

Keep these concerns separate:

- Svelte components and routes: presentation and interaction
- application/domain services: business operations
- repositories: persistence operations
- Dexie database module: IndexedDB schema and migrations

Svelte components should not contain substantial persistence or domain logic.

Prefer small, understandable abstractions over speculative infrastructure.

## Data

Use UUIDs for persistent domain record IDs.

Preserve historical Workout snapshots as specified in `docs/DATA_MODEL.md`.

Do not rewrite historical workouts when Circuit or Exercise templates change.

Use Dexie transactions when an operation changes multiple related records.

## UX

The primary device is an iPhone being used during a workout.

Prioritize:

- large typography
- large touch targets
- high contrast
- minimal typing
- minimal interaction steps
- obvious navigation
- reliable offline behavior

The active exercise should dominate the workout screen.

## Quality

Use TypeScript strictly.

Keep functions and modules focused.

Add tests for important domain behavior, particularly:

- starting a workout
- snapshot creation
- previous-set defaults
- completing sets
- completing a workout
- JSON import/export
- database migrations

Run the project's type checks, linting, tests, and production build after substantial changes.
