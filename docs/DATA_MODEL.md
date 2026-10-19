# WtReps — Data Model

## 1. Purpose

This document defines the persistent data model for WtReps Version 1.

WtReps v1 is local-only.

All persistent application data is stored in IndexedDB through Dexie.

The data model must support:

- reusable Exercises,
- reusable Circuits,
- machine settings,
- ordered Exercises within Circuits,
- active Workouts,
- historical Workouts,
- historical Exercise snapshots,
- Workout Sets,
- previous-performance lookup,
- JSON export/import,
- future schema migration.

The model should remain simple and local-first.

---

# 2. Core Design Principle

WtReps separates reusable templates from historical Workout data.

Template entities:

- Exercise
- ExerciseSetting
- Circuit
- CircuitExercise

Historical entities:

- Workout
- WorkoutExercise
- WorkoutExerciseSetting
- WorkoutSet

This distinction is important.

Template data can change over time.

Historical Workout data must remain accurate even if templates are later changed.

---

# 3. Entity Overview

The Version 1 persistent entities are:

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
```

No cloud, account, device, sync, or authentication entities exist in Version 1.

---

# 4. IDs

Every persistent entity should use an application-generated UUID string.

Example:

```text
4a473198-a75e-4d39-9a09-42d34d131271
```

Use UUIDs rather than auto-incrementing integers.

Reasons:

- safe JSON import/export,
- stable references,
- easier future migration,
- avoids coupling records to IndexedDB-generated numeric IDs.

---

# 5. Common Metadata

Most persistent records should include:

```text
id
createdAt
updatedAt
```

Dates should be stored as ISO 8601 UTC strings.

Example:

```json
{
    "id": "4a473198-a75e-4d39-9a09-42d34d131271",
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:10:00.000Z"
}
```

The UI is responsible for displaying dates in local time.

---

# 6. Deletion Strategy

Version 1 does not require soft deletion.

Records may be physically deleted from IndexedDB when the user deletes them.

However:

- deleting an Exercise must not delete historical WorkoutExercise snapshots,
- deleting a Circuit must not delete historical Workouts,
- deleting an Exercise may require removing its CircuitExercise relationships,
- deleting a Circuit should remove its CircuitExercise relationships.

Historical Workout records are independent snapshots.

---

# 7. Exercise

An Exercise represents a reusable machine or movement.

Examples:

- Chest Press
- Leg Press
- Seated Row
- Lat Pulldown

Recommended structure:

```text
Exercise
--------
id
name
notes
weightUnitOverride
createdAt
updatedAt
```

Example:

```json
{
    "id": "exercise-chest-press",
    "name": "Chest Press",
    "notes": "Keep elbows slightly below shoulder height.",
    "weightUnitOverride": null,
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:00:00.000Z"
}
```

---

# 8. Exercise Fields

## id

Type:

```text
string
```

Required.

UUID.

## name

Type:

```text
string
```

Required.

Suggested validation:

```text
1–100 characters
```

## notes

Type:

```text
string
```

Optional.

May be empty.

## weightUnitOverride

Type:

```text
"lb" | "kg" | null
```

Optional.

If null, the application uses the global AppSettings weight unit.

---

# 9. ExerciseSetting

Each Exercise may have up to five optional machine settings.

Recommended structure:

```text
ExerciseSetting
---------------
id
exerciseId
position
label
value
createdAt
updatedAt
```

Example:

```json
{
    "id": "setting-seat",
    "exerciseId": "exercise-chest-press",
    "position": 1,
    "label": "Seat",
    "value": "7",
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:00:00.000Z"
}
```

---

# 10. ExerciseSetting Fields

## exerciseId

References:

```text
Exercise.id
```

Required.

## position

Type:

```text
integer
```

Required.

Allowed values:

```text
1–5
```

Determines display order.

## label

Type:

```text
string
```

Required when the setting exists.

Suggested validation:

```text
1–50 characters
```

Examples:

- Seat
- Handle Position
- Back Pad
- ROM

## value

Type:

```text
string
```

Required when the setting exists.

Suggested validation:

```text
1–100 characters after trimming
```

Values must be strings because machine settings may contain non-numeric values.

Examples:

- 7
- B
- Middle
- High
- Position 3

---

# 11. Exercise Setting Rules

Each Exercise may have:

```text
0–5
```

ExerciseSetting records.

When creating a new Exercise, the UI should default the first setting label to:

```text
Seat
```

The user may remove or rename it.

The data layer should not assume that position 1 always means Seat.

Persist a setting only when both `label` and `value` are non-empty after trimming.
Incomplete rows are temporary form state and must be omitted when saving. Preserve
the explicit positions of saved rows; gaps after removing incomplete rows are valid.

---

# 12. Circuit

A Circuit represents a reusable ordered collection of Exercises.

Recommended structure:

```text
Circuit
-------
id
name
description
createdAt
updatedAt
```

Example:

```json
{
    "id": "circuit-full-body",
    "name": "Full Body",
    "description": "Perinton Community Center Precor circuit",
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:00:00.000Z"
}
```

---

# 13. Circuit Fields

## name

Required.

Suggested validation:

```text
1–100 characters
```

## description

Optional string.

May be empty.

---

# 14. CircuitExercise

CircuitExercise represents the relationship between a Circuit and an Exercise.

It also stores the Exercise order within the Circuit.

Recommended structure:

```text
CircuitExercise
---------------
id
circuitId
exerciseId
position
createdAt
updatedAt
```

Example:

```json
{
    "id": "ce-001",
    "circuitId": "circuit-full-body",
    "exerciseId": "exercise-chest-press",
    "position": 3,
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:00:00.000Z"
}
```

---

# 15. CircuitExercise Rules

A Circuit may contain many Exercises.

An Exercise may belong to many Circuits.

Version 1 should not allow the same Exercise to appear more than once in the same Circuit.

Within one Circuit:

```text
position
```

must be unique and should use positive integers beginning at 1.

Example:

```text
1 Leg Press
2 Seated Row
3 Chest Press
4 Lat Pulldown
```

When order changes, positions should be normalized.

---

# 16. Workout

A Workout represents one actual workout session.

Recommended structure:

```text
Workout
-------
id
circuitId
circuitName
status
currentExercisePosition
startedAt
completedAt
createdAt
updatedAt
```

Example:

```json
{
    "id": "workout-001",
    "circuitId": "circuit-full-body",
    "circuitName": "Full Body",
    "status": "completed",
    "currentExercisePosition": 1,
    "startedAt": "2026-10-18T22:00:00.000Z",
    "completedAt": "2026-10-18T22:47:00.000Z",
    "createdAt": "2026-10-18T22:00:00.000Z",
    "updatedAt": "2026-10-18T22:47:00.000Z"
}
```

---

# 17. Workout Status

Allowed values:

```text
"in_progress"
"completed"
"abandoned"
```

Version 1 should normally allow only one Workout with:

```text
status = "in_progress"
```

at a time.

---

# 18. Workout Fields

## circuitId

References the Circuit used to start the Workout.

May reference a Circuit that is later deleted.

Historical Workouts must remain valid even if the Circuit no longer exists.

## circuitName

Snapshot of the Circuit name when the Workout started.

This must be stored separately from the Circuit reference.

Example:

The Circuit is later renamed from:

```text
Full Body
```

to:

```text
Full Body A
```

The old Workout may still display:

```text
Full Body
```

## startedAt

Required UTC ISO timestamp.

## completedAt

Type:

```text
string | null
```

Null while the Workout is in progress.

Set when the Workout is completed or abandoned.

---

# 19. WorkoutExercise

WorkoutExercise is a historical snapshot of an Exercise within a specific Workout.

Recommended structure:

```text
WorkoutExercise
---------------
id
workoutId
exerciseId
exerciseName
exerciseNotes
position
weightUnit
createdAt
updatedAt
```

Example:

```json
{
    "id": "we-001",
    "workoutId": "workout-001",
    "exerciseId": "exercise-chest-press",
    "exerciseName": "Chest Press",
    "exerciseNotes": "Keep elbows slightly below shoulder height.",
    "position": 3,
    "weightUnit": "lb",
    "createdAt": "2026-10-18T22:00:00.000Z",
    "updatedAt": "2026-10-18T22:00:00.000Z"
}
```

---

# 20. WorkoutExercise Purpose

WorkoutExercise must preserve the Exercise state at the time the Workout was started.

The app must not depend on the current Exercise template when displaying historical Workouts.

For example:

Current Exercise later changes from:

```text
Chest Press
```

to:

```text
Chest Press Machine #2
```

The old Workout should still display:

```text
Chest Press
```

---

# 21. WorkoutExercise Fields

## workoutId

References:

```text
Workout.id
```

Required.

## exerciseId

References the source Exercise.

Used for:

- Exercise history,
- previous-performance lookup.

This reference should remain even if the source Exercise is later deleted.

## exerciseName

Historical snapshot.

## exerciseNotes

Historical snapshot.

May be empty.

## position

Exercise order within this Workout.

Must not change if the source Circuit is reordered later.

## weightUnit

Allowed:

```text
"lb" | "kg"
```

Resolved when the Workout starts.

Resolution order:

```text
Exercise.weightUnitOverride
```

if present, otherwise:

```text
AppSettings.weightUnit
```

The resolved value is stored in the WorkoutExercise snapshot.

---

# 22. WorkoutExerciseSetting

WorkoutExerciseSetting is a historical snapshot of a machine setting used for a WorkoutExercise.

Recommended structure:

```text
WorkoutExerciseSetting
----------------------
id
workoutExerciseId
sourceExerciseSettingId
position
label
value
createdAt
updatedAt
```

Example:

```json
{
    "id": "wes-001",
    "workoutExerciseId": "we-001",
    "sourceExerciseSettingId": "setting-seat",
    "position": 1,
    "label": "Seat",
    "value": "7",
    "createdAt": "2026-10-18T22:00:00.000Z",
    "updatedAt": "2026-10-18T22:00:00.000Z"
}
```

---

# 23. WorkoutExerciseSetting Rules

Machine settings should be copied from ExerciseSetting records when the Workout starts.

If the Exercise template later changes:

```text
Seat = 7
```

to:

```text
Seat = 8
```

the historical WorkoutExerciseSetting remains:

```text
Seat = 7
```

Historical settings may be manually edited if the user is correcting inaccurate data.

Editing historical settings must not modify ExerciseSetting templates.

---

# 24. WorkoutSet

WorkoutSet represents one Set associated with a WorkoutExercise.

Suggested and completed Sets use the same entity.

Recommended structure:

```text
WorkoutSet
----------
id
workoutExerciseId
position
weight
reps
isCompleted
completedAt
createdAt
updatedAt
```

Example:

```json
{
    "id": "set-001",
    "workoutExerciseId": "we-001",
    "position": 1,
    "weight": 100,
    "reps": 12,
    "isCompleted": true,
    "completedAt": "2026-10-18T22:18:42.000Z",
    "createdAt": "2026-10-18T22:15:00.000Z",
    "updatedAt": "2026-10-18T22:18:42.000Z"
}
```

---

# 25. WorkoutSet Fields

## position

Positive integer.

Determines Set order.

Example:

```text
1
2
3
```

## weight

Type:

```text
number | null
```

May temporarily be null while editing.

Completed Sets must have a valid weight.

Weight may contain decimals.

Valid examples:

```text
100
102.5
27.5
```

Do not store:

```text
"100 lb"
```

The unit belongs to WorkoutExercise.weightUnit.

## reps

Type:

```text
integer | null
```

May temporarily be null while editing.

Completed Sets must have valid reps.

## isCompleted

Boolean.

```text
false
```

means the Set is suggested or still being edited.

```text
true
```

means the Set was performed.

## completedAt

Type:

```text
string | null
```

Set when isCompleted becomes true.

---

# 26. Suggested Sets

Suggested Sets are normal WorkoutSet records.

Example:

```json
{
    "weight": 100,
    "reps": 12,
    "isCompleted": false,
    "completedAt": null
}
```

No separate SuggestedSet entity should exist.

---

# 27. Initial Suggested Set Generation

Copy weight and reps if historical and new WorkoutExercise units match. If units
differ, copy reps and set weight to `null`; do not convert lb/kg in Version 1.
Last Time queries the historical snapshot explicitly and retains its stored unit.

When a Workout starts, the app should find the most recent completed Workout containing the same Exercise.

Lookup should use:

```text
WorkoutExercise.exerciseId
```

not Exercise name.

Example history:

```text
Oct 12:
95 × 12
95 × 11

Oct 15:
100 × 10
100 × 9
```

New Workout suggestions should come from Oct 15:

```text
100 × 10
100 × 9
```

Each copied Set begins as:

```text
isCompleted = false
```

---

# 28. Add Set Behavior

When the user taps:

```text
+ Set
```

the new Set should copy the values from the most recent Set in the current WorkoutExercise.

Example:

```text
Set 1: 100 × 10
Set 2: 100 × 9
```

New Set:

```text
Set 3: 100 × 9
```

with:

```text
isCompleted = false
```

If no Set exists yet, the UI may create an empty Set.

---

# 29. Completing a Set

A Set may be marked completed only if:

```text
weight != null
reps != null
weight >= 0
reps >= 0
```

When completed:

```text
isCompleted = true
completedAt = current UTC timestamp
updatedAt = current UTC timestamp
```

---

# 30. Uncompleting a Set

The active Workout Edit action does not uncomplete a Set. Valid edits preserve
`isCompleted = true` and the original `completedAt`, updating values and `updatedAt`.
Incomplete temporary input while editing a completed Set stays local until valid.

If the UI allows a completed Set to be reopened:

```text
isCompleted = false
completedAt = null
```

The weight and reps remain.

---

# 31. Workout Completion

When the user ends a Workout:

1. Remove incomplete WorkoutSet records for that Workout.
2. Preserve completed WorkoutSet records.
3. Set Workout.status to:

```text
completed
```

4. Set Workout.completedAt.
5. Update Workout.updatedAt.

Incomplete suggested Sets should not remain in completed history.

---

# 32. Abandoned Workout

When a Workout is abandoned:

Recommended Version 1 behavior:

```text
Workout.status = "abandoned"
```

and:

```text
completedAt = current time
```

Incomplete Set records may be removed.

Completed Set records may remain for diagnostic/history purposes.

Normal Workout History should exclude abandoned Workouts unless a future UI explicitly chooses to show them.

---

# 33. Exercise History

Exercise history is derived from historical entities.

Conceptually:

```text
Find WorkoutExercise
WHERE exerciseId = targetExerciseId

Join parent Workout
WHERE Workout.status = "completed"

Load completed WorkoutSets

Sort by Workout.completedAt descending
```

Example result:

```text
Chest Press

Oct 18
100 × 12
100 × 11

Oct 15
100 × 10
100 × 9

Oct 12
95 × 12
95 × 11
```

---

# 34. Previous Performance Lookup

For a given Exercise:

1. Find WorkoutExercise records with matching:

```text
exerciseId
```

2. Only include parent Workouts where:

```text
status = "completed"
```

3. Sort by:

```text
Workout.completedAt DESC
```

4. Use the most recent result containing completed Sets.

Do not use Exercise name for identity.

Names may change.

---

# 35. Workout Duration

Workout duration should be derived rather than stored.

Calculation:

```text
completedAt - startedAt
```

Example:

```text
47 minutes
```

No dedicated duration column is required in Version 1.

---

# 36. Derived Values

These values should initially be calculated rather than persisted:

- Workout duration,
- number of completed Sets,
- number of Exercises,
- training volume.

Example training volume:

```text
sum(weight × reps)
```

for completed Sets.

Do not duplicate derived data unless future performance requirements justify it.

---

# 37. AppSettings

AppSettings stores global application preferences.

Recommended structure:

```text
AppSettings
-----------
id
weightUnit
restTimerEnabled
defaultRestSeconds
lastExportAt
createdAt
updatedAt
```

Only one AppSettings record should normally exist.

Use a stable ID:

```text
app-settings
```

Example:

```json
{
    "id": "app-settings",
    "weightUnit": "lb",
    "restTimerEnabled": false,
    "defaultRestSeconds": 90,
    "lastExportAt": null,
    "createdAt": "2026-10-19T02:00:00.000Z",
    "updatedAt": "2026-10-19T02:00:00.000Z"
}
```

---

# 38. AppSettings Fields

## weightUnit

Allowed:

```text
"lb"
"kg"
```

Default:

```text
"lb"
```

## restTimerEnabled

Boolean.

May remain unused if the optional rest timer is deferred.

## defaultRestSeconds

Integer.

Suggested default:

```text
90
```

## lastExportAt

Type:

```text
string | null
```

Optional.

May be used to show:

```text
Last backup: 14 days ago
```

---

# 39. Relationships

Conceptually:

```text
Exercise
   |
   +----< ExerciseSetting
   |
   +----< CircuitExercise >---- Circuit
   |
   +----< WorkoutExercise >---- Workout
              |
              +----< WorkoutExerciseSetting
              |
              +----< WorkoutSet
```

---

# 40. Relationship Cardinality

```text
Exercise
1 -> many ExerciseSetting
```

```text
Circuit
1 -> many CircuitExercise
```

```text
Exercise
1 -> many CircuitExercise
```

```text
Workout
1 -> many WorkoutExercise
```

```text
WorkoutExercise
1 -> many WorkoutExerciseSetting
```

```text
WorkoutExercise
1 -> many WorkoutSet
```

---

# 41. Historical Boundary

The core rule is:

```text
Exercise / ExerciseSetting / Circuit / CircuitExercise
=
current reusable templates
```

```text
Workout / WorkoutExercise / WorkoutExerciseSetting / WorkoutSet
=
historical facts
```

Template changes must not automatically mutate historical records.

---

# 42. Workout Snapshot Creation

When the user starts a Workout:

1. Create Workout.
2. Snapshot Circuit name.
3. Load CircuitExercises ordered by position.
4. Load corresponding Exercises.
5. Create one WorkoutExercise per Exercise.
6. Snapshot Exercise name.
7. Snapshot Exercise notes.
8. Resolve and snapshot weight unit.
9. Copy ExerciseSettings into WorkoutExerciseSettings.
10. Find previous completed performance for each Exercise.
11. Create suggested WorkoutSets as incomplete records.

The operation should be performed in one Dexie transaction.

---

# 43. Template Changes After Workout Start

Once a Workout starts, later changes to templates must not alter it.

For example, if the user changes:

```text
Seat 7
```

to:

```text
Seat 8
```

while an active Workout exists, the active Workout should continue showing its snapshot:

```text
Seat 7
```

Similarly, active Workout Exercise order should not change if the Circuit template is reordered.

---

# 44. Deleting an Exercise

When deleting an Exercise:

1. Delete the Exercise record.
2. Delete related ExerciseSetting records.
3. Delete related CircuitExercise records.
4. Do not delete WorkoutExercise records.
5. Do not delete WorkoutExerciseSetting records.
6. Do not delete WorkoutSet records.

Historical Workouts must remain readable.

---

# 45. Deleting a Circuit

When deleting a Circuit:

1. Delete the Circuit record.
2. Delete related CircuitExercise records.
3. Do not delete Workout records created from the Circuit.
4. Do not delete WorkoutExercise records.

Historical Workouts retain the snapshotted Circuit name.

---

# 46. Deleting a Workout

When deleting a Workout:

Delete:

- Workout,
- related WorkoutExercise records,
- related WorkoutExerciseSetting records,
- related WorkoutSet records.

This should be performed in one Dexie transaction.

Template entities must remain unchanged.

---

# 47. Editing Historical Workouts

Corrections are saved transactionally from an explicit local draft, for completed
Workouts only. Existing Sets retain IDs, creation times, and original `completedAt`;
edited values/positions update `updatedAt`. Newly added historical Sets are completed
immediately on Save and use the current UTC Save time for `completedAt`. Remaining
Set positions are normalized to 1..N. Saving also updates Workout.updatedAt.

Historical machine-setting correction edits values only (trimmed, 1–100 characters).
Labels, Exercise/Circuit names, units, snapshot order, and template records are not
editable here. Snapshot Exercises with zero Sets remain available in edit mode for
adding a missing Set, but are omitted from normal detail. A stale draft is rejected
if Workout.updatedAt changed in another window. This needs no new schema version.

Historical Workout data may be edited.

Allowed corrections may include:

- WorkoutSet.weight,
- WorkoutSet.reps,
- adding a historical WorkoutSet,
- deleting a WorkoutSet,
- WorkoutExerciseSetting values.

Editing historical records must not update templates.

---

# 48. JSON Export Structure

The JSON export should contain all persistent user data.

The fields below are top-level properties. Do not wrap collections in `data`.

Recommended structure:

```json
{
    "schemaVersion": 2,
    "exportedAt": "2026-10-19T02:40:00.000Z",
    "appSettings": {},
    "exercises": [],
    "exerciseSettings": [],
    "circuits": [],
    "circuitExercises": [],
    "workouts": [],
    "workoutExercises": [],
    "workoutExerciseSettings": [],
    "workoutSets": []
}
```

---

# 49. Export Exclusions

Version 1 contains no credentials or backend metadata.

The export should contain only user/application data.

Do not export:

- service-worker cache data,
- browser metadata,
- temporary UI state.

---

# 50. JSON Import

The implemented backup boundary accepts Version 2 only. Version 1 files are rejected
as unsupported; newer versions receive an update-required explanation. Unknown fields,
duplicate IDs/ownership positions, duplicate Circuit membership, broken required
relationships, multiple active Workouts, and invalid resume positions are rejected
before replacement. Existing positive position gaps are valid; import does not renumber
records. Machine settings retain unique positions 1–5. Historical source template IDs
may reference deleted records. AppSettings is exactly one `app-settings` object.

All nine application tables are replaced in one transaction after confirmation.
Imported IDs, timestamps, nulls, preferences, statuses and current Exercise positions
are preserved exactly. No defaults overwrite imported valid AppSettings. Export reads
all nine tables in one consistent readonly transaction and validates with the same
Version 2 schema before download initiation. `lastExportAt` is updated only afterward,
so the file contains the previous last-export timestamp from its consistent snapshot.

Version 1 import may use full replacement.

Recommended process:

1. Parse JSON.
2. Validate structure.
3. Validate schemaVersion.
4. Validate entity values.
5. Validate references where practical.
6. Start one Dexie transaction.
7. Clear existing application tables.
8. Insert imported records.
9. Commit transaction.

If validation fails, existing data must remain unchanged.

---

# 51. Import Referential Validation

Import should verify important references such as:

```text
ExerciseSetting.exerciseId -> Exercise.id
```

```text
CircuitExercise.circuitId -> Circuit.id
```

```text
CircuitExercise.exerciseId -> Exercise.id
```

```text
WorkoutExercise.workoutId -> Workout.id
```

```text
WorkoutExerciseSetting.workoutExerciseId -> WorkoutExercise.id
```

```text
WorkoutSet.workoutExerciseId -> WorkoutExercise.id
```

Historical references to deleted templates may legitimately point to Exercise or Circuit IDs that are no longer present.

Therefore:

```text
WorkoutExercise.exerciseId
```

and:

```text
Workout.circuitId
```

do not require the current template record to exist during import.

---

# 52. Dexie Tables

Version 1 should use these Dexie tables:

```text
exercises
exerciseSettings
circuits
circuitExercises
workouts
workoutExercises
workoutExerciseSettings
workoutSets
appSettings
```

---

# 53. Recommended IndexedDB Indexes

Indexes should support expected application queries.

Exact Dexie schema syntax may vary, but conceptually:

## exercises

Index:

```text
id
name
updatedAt
```

## exerciseSettings

Indexes:

```text
id
exerciseId
[exerciseId+position]
```

## circuits

Indexes:

```text
id
name
updatedAt
```

## circuitExercises

Indexes:

```text
id
circuitId
exerciseId
[circuitId+position]
[circuitId+exerciseId]
```

## workouts

Indexes:

```text
id
status
startedAt
completedAt
circuitId
```

## workoutExercises

Indexes:

```text
id
workoutId
exerciseId
[workoutId+position]
```

## workoutExerciseSettings

Indexes:

```text
id
workoutExerciseId
[workoutExerciseId+position]
```

## workoutSets

Indexes:

```text
id
workoutExerciseId
isCompleted
[workoutExerciseId+position]
completedAt
```

## appSettings

Index:

```text
id
```

---

# 54. Important Unique Constraints

Dexie/IndexedDB does not need to enforce every domain constraint directly, but application logic should enforce:

```text
CircuitExercise:
unique combination of circuitId + exerciseId
```

Version 1 should not allow duplicate Exercise membership in one Circuit.

Also enforce:

```text
ExerciseSetting:
unique combination of exerciseId + position
```

and:

```text
CircuitExercise:
unique combination of circuitId + position
```

and:

```text
WorkoutExercise:
unique combination of workoutId + position
```

and:

```text
WorkoutSet:
unique combination of workoutExerciseId + position
```

---

# 55. Validation Rules

Recommended validation:

## Exercise.name

```text
required
trimmed
1–100 characters
```

## Exercise.notes

```text
optional
```

## ExerciseSetting.label

```text
required if setting exists
1–50 characters
```

## ExerciseSetting.value

```text
string
1–100 characters after trimming; omit rows with an empty label or value
```

## Circuit.name

```text
required
trimmed
1–100 characters
```

## weight

```text
null while editing
otherwise number >= 0
```

## reps

```text
null while editing
otherwise integer >= 0
```

## position

```text
integer >= 1
```

---

# 56. Data Access Rules

Svelte components should not query Dexie tables directly unless there is a compelling reason.

Use repository functions or application services.

Examples:

```text
ExerciseRepository
CircuitRepository
WorkoutRepository
SettingsRepository
```

Examples of higher-level operations:

```text
StartWorkoutService
CompleteWorkoutService
ExportDataService
ImportDataService
```

This keeps persistence logic separate from UI code.

---

# 57. Transactions

Use Dexie transactions for operations that affect multiple related records.

Important examples:

- creating an Exercise and its settings,
- deleting an Exercise and Circuit relationships,
- creating a Circuit and membership records,
- reordering CircuitExercises,
- starting a Workout,
- completing a Workout,
- deleting a Workout,
- replacing all data during import.

Partial writes should be avoided.

---

# 58. Database Versioning

Dexie schema versions must be explicit.

Example conceptually:

```text
Version 1
initial schema
```

Future schema changes must use new Dexie versions and migrations.

Do not silently modify the existing schema without increasing the database version.

---

# 59. Database Name

Use a stable database name:

```text
WtReps
```

Do not rename the database casually after release because doing so would make existing local user data appear missing.

---

# 60. TypeScript Types

Persistent entities should have explicit TypeScript interfaces or types.

Suggested names:

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
```

Avoid using untyped generic objects for persisted data.

---

# 61. Domain Types

Recommended shared types include:

```text
type WeightUnit = 'lb' | 'kg';
```

```text
type WorkoutStatus =
  | 'in_progress'
  | 'completed'
  | 'abandoned';
```

---

# 62. Source of Truth

The IndexedDB database is the application's persistent source of truth.

Do not duplicate persistent Workout state in a separate global state store.

Transient UI state may live in Svelte state.

Persistent domain state belongs in Dexie.

---

# 63. Non-Persistent UI State

Examples of values that do not belong in the persistent data model:

- current dialog open/closed state,
- currently focused input,
- active tab,
- temporary validation messages,
- swipe gesture state,
- animation state.

An exception is active Workout progress that must survive closing the app.

Anything required to resume a Workout should be derivable from persisted Workout data.

---

# 64. Active Exercise Position

Workout requires `currentExercisePosition: number`, a positive integer identifying
a WorkoutExercise snapshot position, not an array index. Initialize to 1 on start;
persist Previous/Next navigation and clamp invalid/missing positions to an available
snapshot position (first if missing, nearest if out of range). No Exercises uses 1.

Dexie version 2 preserves all existing records and backfills/clamps this field using
ordered snapshots during upgrade from version 1. No index is needed for this field.
Export format version 2 includes it on every Workout. Current import accepts v2 only;
any future support for v1 files must migrate Workouts using the same rule before
validating version 2 data.
Top-level export collections remain unchanged; no `data` wrapper is introduced.

---

# 65. Version 1 Data Model Summary

The final Version 1 persistent model is:

```text
Exercise
- id
- name
- notes
- weightUnitOverride
- createdAt
- updatedAt
```

```text
ExerciseSetting
- id
- exerciseId
- position
- label
- value
- createdAt
- updatedAt
```

```text
Circuit
- id
- name
- description
- createdAt
- updatedAt
```

```text
CircuitExercise
- id
- circuitId
- exerciseId
- position
- createdAt
- updatedAt
```

```text
Workout
- id
- circuitId
- circuitName
- status
- currentExercisePosition
- startedAt
- completedAt
- createdAt
- updatedAt
```

```text
WorkoutExercise
- id
- workoutId
- exerciseId
- exerciseName
- exerciseNotes
- position
- weightUnit
- createdAt
- updatedAt
```

```text
WorkoutExerciseSetting
- id
- workoutExerciseId
- sourceExerciseSettingId
- position
- label
- value
- createdAt
- updatedAt
```

```text
WorkoutSet
- id
- workoutExerciseId
- position
- weight
- reps
- isCompleted
- completedAt
- createdAt
- updatedAt
```

```text
AppSettings
- id
- weightUnit
- restTimerEnabled
- defaultRestSeconds
- lastExportAt
- createdAt
- updatedAt
```

---

# 66. Most Important Modeling Rules

1. Exercises and Circuits are reusable templates.

2. Workouts contain snapshots.

3. Editing templates must not rewrite historical Workouts.

4. Suggested Sets are normal WorkoutSet records with `isCompleted = false`.

5. Incomplete Sets are removed when a Workout is completed.

6. Previous performance is looked up using stable `exerciseId` values.

7. Historical Workout records remain readable even if the source Exercise or Circuit is deleted.

8. The local IndexedDB database is the persistent source of truth.

9. Multi-record operations must use transactions.

10. JSON export must contain enough information to fully restore the database.
