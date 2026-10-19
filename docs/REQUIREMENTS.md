# WtReps — Product Requirements

## 1. Product Overview

WtReps is a mobile-first, local-first Progressive Web App for recording strength-training workouts, especially workouts performed on selectorized weight-training machines.

The primary use case is a user moving through a predefined exercise circuit while using an iPhone at the gym.

The app should make it fast and easy to:

1. Select a workout circuit.
2. Start a workout.
3. Move through exercises in order.
4. See the machine settings required for each exercise.
5. See what was performed the previous time that exercise was completed.
6. Record the current workout's weight and repetitions.
7. Move to the next exercise.
8. End the workout.
9. Review workout and exercise history later.

WtReps should prioritize:

- simplicity,
- large readable controls,
- minimal typing,
- fast data entry,
- offline operation,
- reliable local persistence,
- accurate workout history.

---

# 2. Version 1 Scope

Version 1 is a completely local application.

It must:

- work without a backend,
- work without an account,
- work without authentication,
- store all user data locally,
- operate fully offline after installation,
- support JSON export and import for backup and portability.

Version 1 does not include cloud synchronization.

Future versions may add optional backend synchronization and cross-device access, but those features must not affect the Version 1 implementation unless explicitly added to the requirements later.

---

# 3. Primary Device

WtReps is primarily designed for use on an iPhone during a workout.

Desktop browsers may also be used for:

- managing exercises,
- managing circuits,
- reviewing history,
- importing data,
- exporting data.

The active workout experience should always prioritize the mobile use case.

---

# 4. Progressive Web App

WtReps must be installable as a Progressive Web App.

The PWA must:

- include a valid manifest,
- include appropriate application icons,
- support standalone display mode,
- cache the application shell,
- launch from the iPhone home screen,
- continue functioning when offline.

Once installed, WtReps should feel as close as practical to a native mobile application.

---

# 5. Local-First Behavior

The local database is the source of truth.

The application must not require Internet access to:

- start a workout,
- resume a workout,
- view machine settings,
- record sets,
- navigate between exercises,
- end a workout,
- view local workout history,
- view local exercise history,
- edit exercises,
- edit circuits.

User changes should be persisted locally immediately after meaningful actions.

The user should never need to press a separate Save button during a workout.

---

# 6. Readability and Accessibility

The active workout interface must be usable without reading glasses.

Important requirements include:

- large typography,
- large touch targets,
- high contrast,
- minimal visual clutter,
- minimal small text,
- minimal icon-only controls,
- minimal modal dialogs.

During an active workout, the current exercise should occupy most of the screen.

Important numeric values such as weight and reps should be especially large and easy to read.

---

# 7. Core Concepts

WtReps contains the following primary concepts:

- Exercise
- Exercise Setting
- Circuit
- Workout
- Workout Exercise
- Workout Set
- App Settings

Exercises and Circuits are reusable templates.

Workouts are historical records of what was actually performed.

Historical workout data must remain accurate even if templates are later modified.

---

# 8. Exercises

An Exercise represents a reusable movement or machine.

Examples:

- Chest Press
- Leg Press
- Seated Row
- Lat Pulldown
- Shoulder Press

Exercises exist independently of Circuits.

The same Exercise may appear in multiple Circuits.

For example:

Full Body:

- Chest Press
- Leg Press
- Seated Row

Upper Body:

- Chest Press
- Seated Row
- Shoulder Press

The Chest Press in both Circuits should refer to the same Exercise.

---

# 9. Exercise Properties

Each Exercise should support:

- name,
- optional notes,
- up to five machine settings,
- optional weight-unit override.

Exercise names are required.

Exercise notes are optional.

Example note:

> Keep elbows slightly below shoulder height.

---

# 10. Machine Settings

Each Exercise may have up to five optional machine settings.

Each setting contains:

- a setting label,
- a setting value.

Examples:

- Seat → 7
- Handle Position → 3
- Back Pad → B
- ROM → Middle

The first setting should default to:

**Seat**

The user may rename it.

The remaining settings should initially be empty.

Persist a machine setting only when both its label and value are non-empty after
trimming. Incomplete rows may remain in temporary form state but must not be saved.

---

# 11. Machine Setting Values

Machine setting values must be treated as text rather than numbers only.

Valid examples include:

- 7
- B
- Middle
- High
- Inside
- Position 3

---

# 12. Machine Settings During Workouts

Machine settings must be prominently visible while viewing an Exercise during an active Workout.

Their purpose is to allow the user to quickly configure the machine before beginning the Exercise.

Machine settings used for a historical Workout must be preserved as a snapshot.

If an Exercise later changes from:

Seat → 7

to:

Seat → 8

an older Workout must still show Seat 7.

---

# 13. Exercise Notes During Workouts

Exercise notes should be visible during an active Workout without taking excessive screen space.

Examples:

- Use neutral grip.
- Keep elbows below shoulders.
- Stop one notch short of full extension.

---

# 14. Circuits

A Circuit is an ordered collection of Exercises.

Examples:

- Full Body
- Upper Body
- Lower Body
- Precor Circuit

The app must support multiple Circuits.

---

# 15. Circuit Properties

Each Circuit should support:

- name,
- optional description,
- ordered list of Exercises.

---

# 16. Creating Circuits

Creating a Circuit is an infrequent task and should not dominate the main workout interface.

If no Circuits exist, WtReps should prominently guide the user to create the first Circuit.

---

# 17. Editing Circuits

The user must be able to:

- rename a Circuit,
- edit its description,
- add Exercises,
- remove Exercises,
- reorder Exercises,
- delete the Circuit.

Changing a Circuit must not modify historical Workouts created from that Circuit.

---

# 18. Exercise Order

Each Exercise in a Circuit has an explicit position.

The workout should follow this order.

The user should be able to reorder Exercises while editing a Circuit.

Drag-and-drop or another simple reorder interaction may be used.

A Circuit should not contain the same Exercise more than once in Version 1.

---

# 19. Starting a Workout

Each Circuit should have a prominent:

**Start Workout**

action.

Starting a Workout should:

1. Create a new Workout.
2. Record the start time.
3. Create historical snapshots of the Exercises in the Circuit.
4. Snapshot Exercise names.
5. Snapshot Exercise notes.
6. Snapshot machine settings.
7. Preserve Exercise order.
8. Find previous completed Sets for each Exercise.
9. Create suggested Sets for the new Workout based on previous performance.

---

# 20. Workout Status

A Workout should support at least:

- in progress,
- completed,
- abandoned.

Only completed Workouts should normally be used as the source of previous-performance defaults.

---

# 21. One Active Workout

Version 1 should normally allow only one active Workout at a time.

If a Workout is already in progress, the user should be prompted to resume or abandon it before starting another.

---

# 22. Active Workout Persistence

An active Workout must be persisted locally immediately.

Changes should be saved after meaningful actions such as:

- starting the Workout,
- changing weight,
- changing reps,
- completing a Set,
- adding a Set,
- deleting a Set,
- moving between Exercises,
- ending the Workout.

No separate Save action should be required.

---

# 23. Resume Interrupted Workout

Closing the PWA, locking the phone, or restarting the browser must not cause the active Workout to be lost.

If an unfinished Workout exists when WtReps opens, the app should prominently display something similar to:

**Workout in Progress**

Full Body

Started 34 minutes ago

**Resume Workout**

The user should also have an option to abandon the Workout.

---

# 24. Active Exercise Screen

During a Workout, one Exercise should occupy most of the screen.

The screen should prominently show:

- Exercise name,
- machine settings,
- optional notes,
- previous performance,
- current Sets,
- Add Set control,
- navigation controls,
- Exercise progress within the Circuit.

Example progress:

**3 of 9**

---

# 25. Previous Exercise Performance

WtReps should show the most recent completed Workout containing the current Exercise.

This should be based on the Exercise itself, not simply the immediately previous overall Workout.

Example:

**Last time**

100 lb × 12

100 lb × 11

100 lb × 9

If the Exercise appears in multiple Circuits, the most recent completed occurrence should still be used.

---

# 26. Exercise Navigation

Exercises should follow the Circuit order.

The active Workout interface should include large visible controls for:

- Previous
- Next

WtReps may also support:

- swipe left → next Exercise,
- swipe right → previous Exercise.

Swipe gestures must be a convenience feature, not the only navigation method.

Gestures should not interfere with normal vertical scrolling or data entry.

---

# 27. Sets

Each Exercise in a Workout may contain multiple Sets.

Each Set should include:

- weight,
- repetitions,
- completion state,
- order.

---

# 28. Suggested Sets

Suggested Sets should be stored as normal Workout Set records with:

- weight,
- reps,
- completion state set to incomplete.

They should not use a separate entity or special storage mechanism.

---

# 29. Initial Suggested Sets

Copy weight and reps only when the previous and current WorkoutExercise weight
units match. If units differ, copy reps but set suggested weight to `null`.
Never convert lb/kg automatically in Version 1. Last Time always displays the
completed historical Sets with their historical WorkoutExercise unit.

When an Exercise begins during a Workout, suggested Sets should default from the most recent completed Workout containing that Exercise.

Example previous Workout:

100 × 12

100 × 10

The new Workout should initially show:

100 × 12

100 × 10

These Sets are suggestions until explicitly completed.

---

# 30. Completed Versus Suggested Sets

Prefilled Set values must not automatically count as performed.

The user must explicitly mark a Set as completed.

Example:

100 lb × 12 ✓

Only completed Sets should count toward Workout history.

---

# 31. Set Entry

Weight and reps should be optimized for rapid numeric entry.

Typical values are:

Weight:

- usually 2–3 digits.

Reps:

- usually 1–2 digits.

The appropriate numeric keyboard should be used on mobile devices.

Important Set values should be large and easy to tap.

---

# 32. Add Set

Each Exercise should have a prominent:

**+ Set**

control.

When a new Set is added, it should default to the values of the most recent Set in the current Workout.

Example:

100 × 10

100 × 9

Tap:

**+ Set**

New Set defaults to:

100 × 9

The user may immediately edit the values.

---

# 33. Delete Set

The user should be able to delete an accidentally added Set.

The interaction should prevent accidental deletion without adding excessive friction.

An undo action is preferred where practical.

---

# 34. Completing a Set

A Set should not be marked complete unless its required values are valid.

A completed Set must contain:

- valid weight,
- valid reps.

A completion action should clearly indicate that the Set has been performed.

---

# 35. Incomplete Sets at Workout Completion

Incomplete suggested Sets should not become part of completed Workout history.

When the user ends a Workout, incomplete suggested Sets should be discarded.

Completed Sets must remain.

---

# 36. Weight Units

WtReps should support:

- pounds,
- kilograms.

A global weight-unit preference should exist.

Initial default may be:

**lb**

The data model should retain the unit associated with historical Workout Exercises.

---

# 37. Workout Completion

The active Workout interface must provide a clear:

**End Workout**

action.

Ending a Workout should:

- record the completion time,
- mark the Workout completed,
- preserve completed Sets,
- remove incomplete suggested Sets,
- preserve historical Exercise snapshots,
- preserve historical machine settings,
- calculate Workout duration,
- make the Workout available in history.

---

# 38. Workout Duration

WtReps should automatically record:

- start time,
- end time,
- duration.

A Pause feature is not required in Version 1.

---

# 39. Historical Snapshot Behavior

Completed Workouts must remain historically accurate even if the user later changes:

- Circuit names,
- Circuit contents,
- Exercise names,
- Exercise notes,
- machine settings,
- Exercise order.

Historical Workouts must not be rewritten when templates change.

---

# 40. Workout History

WtReps must provide a Workout History view.

Completed Workouts should be shown chronologically.

A summary may include:

- date,
- Circuit name,
- duration,
- number of Exercises,
- number of completed Sets.

Example:

October 18, 2026

Full Body

47 minutes

9 exercises

20 sets

---

# 41. Workout Details

Selecting a historical Workout should display:

- Workout date,
- Circuit name,
- duration,
- Exercises performed,
- machine settings used,
- Sets performed,
- weights,
- reps.

---

# 42. Editing Historical Workouts

The user should be able to correct mistakes after a Workout has ended.

Examples:

- change 110 lb to 100 lb,
- change 12 reps to 10 reps,
- remove an accidental Set,
- add a missing Set.

Historical changes must update Exercise history appropriately.

---

# 43. Deleting Workouts

The user should be able to delete an accidentally recorded Workout.

Deletion should use confirmation or an undo mechanism.

Deleting a Workout must not delete:

- Exercise templates,
- Circuit templates.

---

# 44. Exercise History

Each Exercise should have its own history view.

Example:

**Chest Press**

Oct 18

100 × 12

100 × 11

Oct 15

95 × 12

95 × 12

Oct 12

95 × 11

95 × 9

Exercise history should include the Exercise regardless of which Circuit was used.

---

# 45. Exercise Management

The user must be able to:

- create an Exercise,
- rename an Exercise,
- edit notes,
- add machine settings,
- edit machine settings,
- remove machine settings,
- delete an Exercise.

Deleting an Exercise must not erase historical Workout data.

If the Exercise is currently used in one or more Circuits, the user should be warned before deletion.

---

# 46. Circuit Management

The user must be able to:

- create a Circuit,
- rename a Circuit,
- edit its description,
- add Exercises,
- remove Exercises,
- reorder Exercises,
- delete the Circuit.

Deleting a Circuit must not erase historical Workouts.

---

# 47. Empty States

If no Circuits exist, WtReps should prominently guide the user to:

**Create Your First Circuit**

If a Circuit contains no Exercises, the app should guide the user to add Exercises.

If no Exercises exist, the app should guide the user to create the first Exercise.

---

# 48. App Settings

WtReps should support application settings including:

- default weight unit,
- JSON export,
- JSON import,
- storage status if useful.

A future optional rest timer may also be configured here.

---

# 49. JSON Export

The user must be able to export all WtReps data to a JSON file.

The export should include:

- App Settings,
- Exercises,
- Exercise Settings,
- Circuits,
- Circuit Exercise order,
- Workouts,
- Workout Exercise snapshots,
- Workout Exercise Settings,
- Workout Sets.

The exported file must contain enough information to fully restore the user's data.

---

# 50. JSON Export Version

The export must contain a schema version.

Example:

```json
{
    "schemaVersion": 2,
    "exportedAt": "2026-10-19T02:40:00Z",
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

Future versions of WtReps should be able to identify and migrate supported older exports.

These fields and collections belong at the top level; do not wrap them in a `data` property.

---

# 51. JSON Import

WtReps must support importing a previously exported JSON file.

Before importing, the application must:

- validate the file,
- validate the schema version,
- reject invalid data,
- avoid silently overwriting existing data.

Version 1 may support:

**Replace Existing Data**

only.

Merge import is not required.

---

# 52. Local Backup Expectations

WtReps Version 1 has no server backup.

The application should make this clear.

JSON export is the user's backup mechanism.

The Settings interface may display information such as:

**Local data only**

and optionally:

**Last backup: 14 days ago**

if WtReps tracks export timestamps.

---

# 53. Persistent Browser Storage

WtReps should request or use persistent browser storage where supported.

The application must still assume that browser-local data can potentially be lost if:

- the device is lost,
- site data is manually cleared,
- browser data is reset.

For this reason, JSON export remains important.

---

# 54. Offline Behavior

WtReps must remain fully usable during a Workout when there is no Internet connection.

Offline mode should not display disruptive warnings.

If useful, the application may indicate:

**Offline**

but the app should otherwise behave normally.

---

# 55. Application Updates

A new PWA version must not force-refresh the application during an active Workout.

If a new version becomes available while a Workout is active, updating should be deferred until the Workout is finished.

---

# 56. Rest Timer

A rest timer may be added if it remains unobtrusive.

Potential behavior:

- completing a Set starts a timer,
- the timer counts upward or downward,
- the user may ignore it.

This is optional for Version 1.

It should not complicate the initial Workout flow.

---

# 57. Derived Values

Values such as these may be calculated rather than permanently stored:

- Workout duration,
- completed Set count,
- Exercise count,
- training volume.

Complex reporting is not required for Version 1.

---

# 58. Explicitly Out of Scope for Version 1

The following features are not required:

- cloud synchronization,
- backend APIs,
- user accounts,
- login,
- authentication,
- subscriptions,
- device pairing,
- PostgreSQL,
- Supabase,
- AWS services,
- Cloudflare Workers,
- Firebase,
- social networking,
- friends,
- followers,
- public workout sharing,
- leaderboards,
- AI-generated workouts,
- exercise videos,
- nutrition tracking,
- calorie tracking,
- body-weight tracking,
- heart-rate tracking,
- Apple Watch support,
- Apple Health integration,
- workout scheduling,
- coaching plans,
- supersets,
- RPE tracking,
- RIR tracking,
- personal-record badges,
- gamification,
- complex analytics,
- complex charting.

These may be considered later only if they support the core WtReps workflow.

---

# 59. Primary Workout Flow

The defining WtReps experience should be:

**Open WtReps**

↓

**Choose Circuit**

↓

**Start Workout**

↓

Walk up to machine

↓

Immediately see:

- Exercise name
- machine settings
- what was done last time

↓

Perform Set

↓

Record:

**Weight × Reps**

↓

Mark Set complete

↓

Repeat Sets

↓

Tap or swipe:

**Next Exercise**

↓

Repeat through Circuit

↓

**End Workout**

↓

Review summary/history

---

# 60. Success Criteria

WtReps Version 1 should be considered successful if the user can:

1. Install it on an iPhone home screen.
2. Launch it without Internet access.
3. Create Exercises.
4. Define machine settings.
5. Create Circuits.
6. Add Exercises to Circuits.
7. Start a Workout.
8. Immediately see machine setup information.
9. See previous Exercise performance.
10. Record Sets within a few seconds.
11. Use the app comfortably without reading glasses.
12. Close the app and resume an active Workout without losing data.
13. Complete the Workout.
14. Review Workout history.
15. Review Exercise history.
16. Correct historical entry mistakes.
17. Export all data to JSON.
18. Restore data from a JSON export.

---

# 61. Product Philosophy

WtReps should remain focused on one central problem:

> Make recording a machine-based strength workout nearly effortless.

Every feature should be evaluated against whether it improves:

- machine setup,
- visibility of previous performance,
- fast Set entry,
- readability,
- offline reliability,
- workout history,
- data ownership.

Features that add complexity without materially improving that workflow should be deferred.
