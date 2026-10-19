# WtReps — UI Notes

## 1. Purpose

This document defines the intended Version 1 user experience and screen structure for WtReps.

WtReps is primarily used on an iPhone during a workout.

The UI should therefore prioritize:

- large readable text,
- large touch targets,
- minimal typing,
- minimal navigation depth,
- very few modal dialogs,
- fast set entry,
- obvious next actions,
- strong offline behavior,
- one-handed use where practical.

The active workout experience is the highest-priority part of the application.

---

# 2. Primary Navigation

Outside of an active workout, WtReps should use a simple primary navigation structure.

Recommended top-level sections:

- Home
- History
- Manage
- Settings

On mobile, this may be implemented as a bottom navigation bar.

Suggested order:

`Home | History | Manage | Settings`

The exact iconography may be decided later.

Text labels should remain visible rather than relying only on icons.

During an active workout, the normal application navigation should be minimized or hidden.

---

# 3. Screen Inventory

Version 1 should include approximately these screens:

- Home
- Manage
- Exercise List
- Create/Edit Exercise
- Exercise History
- Circuit List
- Create/Edit Circuit
- Add Exercise to Circuit
- Active Workout
- Workout Summary
- Workout History
- Workout Detail
- Edit Historical Workout
- Settings
- Import Data
- Export Data / Backup

Some management functions may share screens.

Avoid creating separate routes/screens unless they improve clarity.

---

# 4. Global Mobile UX Rules

The active workout interface must be usable without reading glasses.

Important requirements include:

- large typography,
- large touch targets,
- high contrast,
- minimal visual clutter,
- minimal small text,
- minimal icon-only controls,
- minimal modal dialogs.

Important numeric values such as weight and reps should be especially large and easy to read.

Important interactive controls should generally provide at least approximately 44–48px of usable touch area.

Portrait orientation is the primary design target.

The application should remain usable in landscape, but Version 1 does not require a special landscape layout.

Account for iPhone safe-area insets, especially for installed PWA mode:

- `env(safe-area-inset-top)`
- `env(safe-area-inset-bottom)`

Use system fonts in Version 1.

Avoid critical runtime dependencies on remote fonts or other external resources.

---

# 5. Visual Priority

When making design tradeoffs, use this priority order:

1. Active Workout usability.
2. Readability without glasses.
3. Fast Set entry.
4. Machine-setting visibility.
5. Previous-performance visibility.
6. Reliable resume behavior.
7. Simple history.
8. Easy management.
9. Visual polish.

WtReps should not look or behave like a generic fitness dashboard.

Avoid:

- dense analytics,
- tiny charts,
- social feeds,
- motivational banners,
- excessive cards,
- dashboard clutter,
- complex navigation.

The interface should be calm, large, and functional.

---

# 6. Home Screen

## 6.1 Goal

The Home screen should answer:

> What workout do I want to do now?

It should make starting or resuming a workout extremely obvious.

The Home screen should primarily show:

- active Workout, if one exists,
- available Circuits,
- a simple path to create/manage Circuits.

Do not turn Home into an analytics dashboard.

---

## 6.2 Mobile Layout

Recommended structure:

```text
┌────────────────────────────────┐
│ WtReps                         │
│                                │
│ [ Active Workout, if any ]     │
│                                │
│ YOUR CIRCUITS                  │
│                                │
│ [ Circuit Card ]               │
│ [ Circuit Card ]               │
│ [ Circuit Card ]               │
│                                │
│ [ + New Circuit ]              │
│                                │
├────────────────────────────────┤
│ Home  History  Manage Settings │
└────────────────────────────────┘
```

The Home screen may scroll vertically if necessary.

---

## 6.3 Active Workout Priority

If a Workout is in progress, it should appear above all Circuits.

Example:

```text
WORKOUT IN PROGRESS

Full Body

Started 34 min ago
Exercise 4 of 9

[ Resume Workout ]

Abandon
```

Resume should be the dominant action.

Circuit Start buttons should be disabled while another Workout is active.

---

## 6.4 Empty State

If there are no Circuits:

```text
WtReps

No circuits yet

Create a circuit with the exercises
you use at the gym.

[ Create Your First Circuit ]
```

Do not require the user to navigate through Manage to create the first Circuit.

---

## 6.5 Circuit Cards

Each Circuit should appear as a large card.

Example:

```text
Full Body
9 exercises
Last: Oct 18

[ Start Workout ]
```

Circuit name should be prominent.

Start Workout should be nearly full width and at least about 52px tall.

Circuit editing should remain secondary.

---

## 6.6 Starting a Workout

When the user taps Start Workout:

1. create the Workout snapshot,
2. generate suggested Sets,
3. persist everything,
4. navigate directly to the first Exercise.

Do not show an intermediate confirmation unless a real issue exists.

---

## 6.7 Home Wireframe

```text
┌────────────────────────────────┐
│ WtReps                         │
│                                │
│ YOUR CIRCUITS                  │
│                                │
│ ┌────────────────────────────┐ │
│ │ Full Body                  │ │
│ │ 9 exercises                │ │
│ │ Last: Oct 18               │ │
│ │                            │ │
│ │ [   Start Workout       ]  │ │
│ └────────────────────────────┘ │
│                                │
│ ┌────────────────────────────┐ │
│ │ Upper Body                 │ │
│ │ 6 exercises                │ │
│ │ Last: Oct 12               │ │
│ │                            │ │
│ │ [   Start Workout       ]  │ │
│ └────────────────────────────┘ │
│                                │
│ [ + New Circuit ]              │
│                                │
├────────────────────────────────┤
│ Home  History  Manage Settings │
└────────────────────────────────┘
```

---

# 7. Active Workout Screen

## 7.1 Goal

The Active Workout screen should let the user answer three questions immediately:

1. What Exercise am I doing?
2. How should I configure the machine?
3. What weight and reps should I do?

The screen should be optimized for:

- iPhone portrait orientation,
- arm's-length viewing,
- large typography,
- one-handed use where practical,
- minimal scrolling,
- minimal typing,
- use without reading glasses.

---

## 7.2 Screen Structure

```text
┌─────────────────────────────┐
│      WORKOUT HEADER         │
├─────────────────────────────┤
│                             │
│      EXERCISE CONTENT       │
│                             │
│      scrollable area        │
│                             │
├─────────────────────────────┤
│     WORKOUT NAVIGATION      │
└─────────────────────────────┘
```

The Exercise area may scroll vertically.

Navigation controls should remain easy to reach near the bottom.

---

## 7.3 Primary Wireframe

```text
┌────────────────────────────────┐
│  3 of 9             Full Body  │
│                                │
│  CHEST PRESS                   │
│                                │
│  ┌──────────────────────────┐  │
│  │ MACHINE SETTINGS         │  │
│  │                          │  │
│  │ Seat                  7  │  │
│  │ Handle Position       3  │  │
│  └──────────────────────────┘  │
│                                │
│  Keep elbows below shoulders   │
│                                │
│  LAST TIME                     │
│  100 × 12   100 × 11           │
│                                │
│  TODAY                         │
│                                │
│  ┌──────────────────────────┐  │
│  │ SET 1                    │  │
│  │                          │  │
│  │ [ 100 ] lb  [ 12 ] reps  │  │
│  │                          │  │
│  │ [     Complete Set     ] │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │ SET 2                    │  │
│  │                          │  │
│  │ [ 100 ] lb  [ 11 ] reps  │  │
│  │                          │  │
│  │ [     Complete Set     ] │  │
│  └──────────────────────────┘  │
│                                │
│ [          + Set           ]   │
│                                │
├────────────────────────────────┤
│ [ ‹ Previous ]     [ Next › ]  │
│                                │
│          End Workout           │
└────────────────────────────────┘
```

This is structural guidance, not final visual styling.

---

## 7.4 Workout Header

Keep the top compact.

Example:

```text
3 of 9                  Full Body
```

Progress should be stronger than Circuit name.

Do not display a large WtReps title during a Workout.

---

## 7.5 Exercise Name

Exercise name should be one of the largest elements.

Suggested size:

- approximately 30–34px.

Long names may wrap to two lines rather than shrinking.

---

## 7.6 Machine Settings

Machine settings should appear immediately below the Exercise name.

They should never be hidden behind accordions, menus, or secondary screens.

Example:

```text
MACHINE SETTINGS

Seat                   7
Handle Position        3
Back Pad               B
```

Values should be visually stronger than labels.

Suggested hierarchy:

- label: approximately 18–20px,
- value: approximately 24–30px and bold.

If there are no machine settings, omit the entire section.

---

## 7.7 Exercise Notes

If notes exist, display them immediately after Machine Settings.

Example:

```text
Keep elbows slightly below shoulder height.
```

Notes should be visually secondary.

If no note exists, reserve no empty space.

---

## 7.8 Previous Performance

Always display historical units in Last Time. Suggested Sets copy weight and reps
only when units match; otherwise weight is blank/null and reps are copied. Do not
convert lb/kg automatically. For example, historical `100 lb × 12` remains visible
while a new kg Set has blank weight and 12 reps.

Display previous performance before today's Sets.

Heading:

```text
LAST TIME
```

Example:

```text
100 × 12
100 × 11
100 × 9
```

"Last Time" means the most recent completed Workout containing this Exercise.

If there is no history:

```text
LAST TIME

No previous sets
```

---

## 7.9 Set Cards

Avoid tiny spreadsheet layouts.

Each current Set should have a clear grouping.

Example:

```text
┌─────────────────────────────┐
│ SET 1                       │
│                             │
│ [ 100 ] lb    [ 12 ] reps   │
│                             │
│ [      Complete Set      ]  │
└─────────────────────────────┘
```

Weight and reps should generally sit side by side.

Suggested input text size:

- 32–40px.

Unit labels may be approximately 18–20px.

---

## 7.10 Numeric Input Behavior

Use numeric-oriented keyboards.

Weight must allow decimals.

Reps should use integer input.

Do not automatically open the keyboard when navigating to an Exercise.

When the user taps an existing value, prefer behavior that makes replacement easy, such as select-all on focus if it behaves well on iPhone.

---

## 7.11 Completing a Set

Use a large explicit action:

```text
✓ Complete Set
```

Minimum height should be around 48–56px.

Do not use a tiny checkbox.

After completion, simplify the Set visually.

Before:

```text
SET 1
[ 100 ] lb   [ 12 ] reps
[ Complete Set ]
```

After:

```text
✓ SET 1
100 lb × 12 reps
Edit
```

Completed Sets should remain editable.

---

## 7.12 Add Set

Place a large:

```text
+ Set
```

button immediately below the Set list.

The new Set should copy the most recent Set's values and remain incomplete.

If an Exercise has no previous history, show one empty Set automatically rather than requiring an extra tap.

---

## 7.13 Exercise Navigation

Persist the current WorkoutExercise snapshot position on navigation and resume it
after reload/reopening. Use visible Previous/Next controls without swipe dependencies.
At the final Exercise, Next becomes Finish, opening the same confirmation as the
separate End Workout action. Navigation scrolls content to the top. The footer stays
sticky with input scroll margins; changing footer layout on blur is avoided because
it can move the Complete Set target during a tap.

Use visible large controls:

```text
[ ‹ Previous ]     [ Next › ]
```

Recommended height:

- approximately 52–60px.

Next may receive stronger visual emphasis.

Prefer sticky placement near the bottom of the screen.

Account for iPhone safe-area insets.

---

## 7.14 Swipe Navigation

Swipe may be supported as a shortcut:

- swipe left → Next Exercise,
- swipe right → Previous Exercise.

Visible buttons remain required.

Swipe should require enough horizontal movement to avoid accidental navigation during vertical scrolling or input interaction.

---

## 7.15 Skipping Exercises

The user may navigate away even if no Sets were completed.

Do not force completion.

---

## 7.16 End Workout

End Workout should be visible but separated from normal Set actions.

Confirmation:

```text
End Workout?

Your completed sets will be saved.
Incomplete sets will be discarded.

[ Keep Working ]
[ End Workout ]
```

Avoid technical language.

---

## 7.17 Keyboard and Footer

When the keyboard is open:

- keep the active input visible,
- avoid covering inputs with sticky navigation,
- temporarily move or hide the footer if needed.

Test on actual iPhone Safari/PWA behavior.

---

## 7.18 Active Workout Type Scale

Suggested starting point:

- Exercise title: 32px
- Machine value: 28px
- Set numeric input: 36px
- Completed Set value: 26px
- Section title: 18px
- Body/support text: 18px
- Small metadata: 16px

Avoid text below 16px during an active Workout unless absolutely necessary.

---

## 7.19 Core Workout Interaction

A typical interaction should feel like:

```text
look
↓
set machine
↓
lift
↓
tap Complete
↓
lift
↓
tap Complete
↓
tap Next
```

The UI should not turn the Workout itself into a data-entry exercise.

---

# 8. Manage Screen

The Manage section should contain:

```text
Exercises
Circuits
```

Suggested layout:

```text
┌────────────────────────────────┐
│ Manage                         │
│                                │
│ ┌────────────────────────────┐ │
│ │ Exercises                  │ │
│ │ 12 exercises               │ │
│ │                            │ │
│ │ Manage Exercises ›         │ │
│ └────────────────────────────┘ │
│                                │
│ ┌────────────────────────────┐ │
│ │ Circuits                   │ │
│ │ 3 circuits                 │ │
│ │                            │ │
│ │ Manage Circuits ›          │ │
│ └────────────────────────────┘ │
│                                │
├────────────────────────────────┤
│ Home  History  Manage Settings │
└────────────────────────────────┘
```

---

# 9. Exercise Management

## 9.1 Exercise List

Purpose:

> Show all reusable Exercises and provide access to create or edit them.

Default ordering:

- alphabetical by Exercise name.

Example:

```text
┌────────────────────────────────┐
│ ‹ Manage                       │
│                                │
│ Exercises                      │
│                                │
│ Chest Press                    │
│ Seat 7 · Handle 3              │
│                                │
│ Lat Pulldown                   │
│ Seat 6 · Pad B                 │
│                                │
│ Leg Press                      │
│ Seat 5                         │
│                                │
│ [ + New Exercise ]             │
└────────────────────────────────┘
```

Tapping an Exercise opens its editor.

---

## 9.2 Exercise List Setting Summary

Keep setting summaries compact.

Examples:

```text
Seat 7 · Handle 3
```

or:

```text
Seat 5 · Back Pad B · +2 more
```

Do not show full notes in the list.

---

## 9.3 Exercise Editor

The editor should support:

- Exercise name,
- machine settings,
- notes,
- weight-unit override,
- View History,
- Delete Exercise.

Recommended order:

1. Exercise Name
2. Machine Settings
3. Notes
4. Weight Unit
5. History
6. Delete

---

## 9.4 Exercise Editor Wireframe

```text
┌────────────────────────────────┐
│ ‹ Exercises                    │
│                                │
│ Edit Exercise                  │
│                                │
│ Exercise Name                  │
│ [ Chest Press              ]   │
│                                │
│ MACHINE SETTINGS               │
│                                │
│ Setting 1                      │
│ Label                          │
│ [ Seat                     ]   │
│ Value                          │
│ [ 7                        ]   │
│ Remove                         │
│                                │
│ Setting 2                      │
│ Label                          │
│ [ Handle Position          ]   │
│ Value                          │
│ [ 3                        ]   │
│ Remove                         │
│                                │
│ [ + Setting ]                  │
│                                │
│ Notes                          │
│ [ Keep elbows below...     ]   │
│                                │
│ Weight Unit                    │
│ [ Use default (lb)        ▼ ]  │
│                                │
│ [      Save Exercise       ]   │
│                                │
│ View History                   │
│ Delete Exercise                │
└────────────────────────────────┘
```

---

## 9.5 New Exercise Defaults

When creating an Exercise:

- Exercise name is empty,
- Setting 1 label defaults to `Seat`,
- Setting 1 value is empty.

The user may rename or remove Seat.

---

## 9.6 Machine Setting Rules

Each setting has:

- Label
- Value

Both are text inputs.

Allow up to five settings.

At five settings, hide or disable `+ Setting`.

Simplest save rule:

> A setting is persisted only when both Label and Value are non-empty after trimming.

Incomplete rows may exist in temporary form state but must not be saved. Preserve
the explicit positions of saved settings; removing a row may leave a gap.

---

## 9.7 Reordering Machine Settings

Version 1 does not require drag-and-drop.

Creation order is acceptable.

If reordering is implemented, use mobile-friendly controls.

---

## 9.8 Weight Unit Override

Recommended selector:

```text
Use default (lb)
Pounds
Kilograms
```

Default is Use default.

---

## 9.9 Saving

Use a clear full-width:

```text
Save Exercise
```

Recommended behavior:

```text
Save
↓
return to Exercise list
↓
show "Exercise saved"
```

If unsaved changes exist and the user navigates away:

```text
Discard changes?

[ Keep Editing ]
[ Discard ]
```

---

## 9.10 Deleting an Exercise

If not used in any Circuit:

```text
Delete Chest Press?

Historical workouts will be preserved.

[ Cancel ]
[ Delete Exercise ]
```

If used by Circuits:

```text
Delete Chest Press?

This exercise is currently used in:

• Full Body
• Upper Body

Deleting it will remove it from those circuits.

Historical workouts will not be changed.

[ Cancel ]
[ Delete Exercise ]
```

---

# 10. Exercise History

Exercise History answers:

> How have I performed on this Exercise over time?

Example:

```text
Chest Press

Oct 18
Full Body
100 lb × 12
100 lb × 11

Oct 15
Full Body
100 lb × 10
100 lb × 9

Oct 12
Upper Body
95 lb × 12
95 lb × 11
```

Show history in reverse chronological order.

Include Circuit name because an Exercise may appear in multiple Circuits.

If no history exists:

```text
No workout history yet.
```

Mixed historical units should display using the stored historical unit.

Do not automatically convert units in Version 1.

---

# 11. Circuit Management

## 11.1 Circuit List

Default ordering:

- alphabetical by Circuit name.

Example:

```text
┌────────────────────────────────┐
│ ‹ Manage                       │
│                                │
│ Circuits                       │
│                                │
│ Full Body                      │
│ 9 exercises                    │
│                                │
│ Lower Body                     │
│ 5 exercises                    │
│                                │
│ Upper Body                     │
│ 6 exercises                    │
│                                │
│ [ + New Circuit ]              │
└────────────────────────────────┘
```

Tapping a Circuit opens its editor.

---

## 11.2 Circuit Editor

The editor should support:

- Circuit name,
- optional description,
- ordered Exercise list,
- add Exercise,
- remove Exercise,
- reorder Exercise,
- save,
- delete Circuit.

Wireframe:

```text
┌────────────────────────────────┐
│ ‹ Circuits                     │
│                                │
│ Edit Circuit                   │
│                                │
│ Circuit Name                   │
│ [ Full Body                ]   │
│                                │
│ Description                    │
│ [ Perinton Precor circuit  ]   │
│                                │
│ EXERCISES                      │
│                                │
│ ≡  1  Leg Press            ⋯   │
│ ≡  2  Chest Press          ⋯   │
│ ≡  3  Seated Row           ⋯   │
│ ≡  4  Lat Pulldown         ⋯   │
│                                │
│ [ + Add Exercise ]             │
│                                │
│ [      Save Circuit        ]   │
│                                │
│ Delete Circuit                 │
└────────────────────────────────┘
```

---

## 11.3 Reordering

Preferred:

- drag-and-drop using a visible handle.

If drag-and-drop proves unreliable on iPhone Safari/PWA, use explicit Up/Down controls.

Do not retain a poor drag implementation just because it appears modern.

Display position numbers and update them immediately after reorder.

Version 1 uses large, labeled Move Up / Move Down controls. This keeps ordering
accessible to touch and keyboard users without adding a drag-and-drop dependency.
Draft array order determines display numbers; saved membership positions are
normalized to consecutive integers starting at 1.

---

## 11.4 Exercise Picker

Show existing Exercises not already in the Circuit.

Sort alphabetically.

Example:

```text
Add Exercise

Chest Press
Seat 7 · Handle 3

Lat Pulldown
Seat 6 · Pad B

Shoulder Press
Seat 4

[ + Create New Exercise ]
```

Selecting an Exercise should:

- add it to the end,
- return to the Circuit editor,
- optionally highlight the new row briefly.

One-at-a-time selection is sufficient for Version 1.

The Version 1 picker is an in-editor screen for both new and saved Circuits, rather
than a separate route. The Circuit editor stays mounted while switching between
its form, picker, and embedded Exercise editor. This preserves the local draft
without a global store or a placeholder Circuit record.

---

## 11.5 Create New Exercise From Circuit

Flow:

```text
Circuit editor
↓
Add Exercise
↓
Create New Exercise
↓
Exercise editor
↓
Save
↓
return to Circuit editor
↓
new Exercise is automatically added
```

Preserve user context.

Reuse the same Exercise editor used by Exercise Management. Saving a new Exercise
persists that Exercise, appends it to the Circuit draft, and returns to the Circuit
form. The Circuit itself is persisted only when Save Circuit is selected. If the
Circuit draft is later discarded, the separately saved Exercise remains available
in the Exercise library. Canceling Exercise creation returns to the picker with
the Circuit draft intact.

---

## 11.6 Removing Exercises

Removing an Exercise from a Circuit does not delete the Exercise template.

Prefer Undo over heavy confirmation.

Example:

```text
Chest Press removed from Full Body

[ Undo ]
```

---

## 11.7 Empty Circuit

If no Exercises exist:

```text
No exercises yet.

Add exercises in the order you perform them.

[ + Add Exercise ]
```

A zero-Exercise Circuit may be saved, but Home must not allow starting it.

---

## 11.8 Deleting Circuit

Confirmation:

```text
Delete Full Body?

This removes the circuit from your current workout options.

Historical workouts using this circuit will be preserved.

[ Cancel ]
[ Delete Circuit ]
```

If the Circuit is the source of the current active Workout, block deletion until the Workout is completed or abandoned.

---

# 12. Workout Summary

The Workout Summary appears immediately after a Workout is completed.

Its purpose is to reassure the user:

> The Workout was saved.

Example:

```text
┌────────────────────────────────┐
│                                │
│       Workout Complete         │
│                                │
│          Full Body             │
│                                │
│          47 min                │
│                                │
│       9 exercises              │
│         20 sets                │
│                                │
│ [      View Workout        ]   │
│                                │
│ [          Done            ]   │
└────────────────────────────────┘
```

Prefer counting Exercises that contain at least one completed Set.

Do not immediately redirect to Home.

---

# 13. History Screen

History should show completed Workouts in reverse chronological order.

Example:

```text
┌────────────────────────────────┐
│ History                        │
│                                │
│ OCTOBER 2026                   │
│                                │
│ Oct 18                         │
│ Full Body                      │
│ 47 min · 20 sets               │
│                                │
│ Oct 15                         │
│ Full Body                      │
│ 44 min · 18 sets               │
│                                │
│ Oct 12                         │
│ Upper Body                     │
│ 38 min · 14 sets               │
│                                │
├────────────────────────────────┤
│ Home  History  Manage Settings │
└────────────────────────────────┘
```

Month grouping is useful but optional.

Search and filtering are not required in Version 1.

If no Workouts exist:

```text
No workouts yet.

Complete your first workout and it will appear here.

[ Go to Home ]
```

---

# 14. Workout Detail

Workout Detail answers:

> What did I actually do during this Workout?

It must use historical snapshots.

Example:

```text
┌────────────────────────────────┐
│ ‹ History                      │
│                                │
│ Full Body                      │
│ Oct 18, 2026                   │
│ 47 min · 20 sets               │
│                                │
│ CHEST PRESS                    │
│ Seat 7 · Handle 3              │
│ 100 lb × 12                    │
│ 100 lb × 11                    │
│                                │
│ LEG PRESS                      │
│ Seat 5                         │
│ 180 lb × 12                    │
│ 180 lb × 12                    │
│                                │
│ [ Edit Workout ]               │
│                                │
│ Delete Workout                 │
└────────────────────────────────┘
```

Display WorkoutExercises in historical position order.

Prefer displaying Exercises with at least one completed Set.

Machine settings must come from WorkoutExerciseSetting snapshots, not current Exercise settings.

---

# 15. Edit Historical Workout

Historical corrections use a local draft and an explicit Save Workout action.
Machine-setting labels remain read-only; values may be corrected. Existing completed
Set timestamps are preserved; new historical Sets use the UTC time of Save. Remove
changes only the draft until Save. All snapshotted Exercises are available in edit
mode, including those with no Sets; adding new Exercise snapshots is not supported.

Use an explicit editing mode.

Normal detail:

```text
100 lb × 12
```

Edit mode:

```text
[ 100 ] lb   [ 12 ] reps
```

Edit mode may change:

- historical Set weight,
- historical reps,
- add Set,
- remove Set,
- historical machine-setting values.

Do not edit current Exercise templates from this screen.

Do not require support for adding entirely new Exercises to an old Workout in Version 1.

---

## 15.1 Edit Wireframe

```text
CHEST PRESS

Machine Settings

Seat
[ 7 ]

Handle Position
[ 3 ]

SETS

Set 1
[ 100 ] lb   [ 12 ] reps
Remove

Set 2
[ 100 ] lb   [ 11 ] reps
Remove

[ + Set ]
```

Use:

```text
Cancel
Save
```

and hide normal bottom navigation while editing.

If the user cancels with changes:

```text
Discard changes?

[ Keep Editing ]
[ Discard ]
```

---

# 16. Delete Workout

Confirmation:

```text
Delete this workout?

Full Body
October 18, 2026

This will permanently remove the workout and its sets from this device.

[ Cancel ]
[ Delete Workout ]
```

Because Version 1 has no cloud backup, be explicit that deletion is permanent.

---

# 17. Settings Screen

## 17.1 Goal

Settings should contain infrequent application preferences and data-management actions.

Recommended sections:

- Workout
- Data & Backup
- Storage
- About

Do not mix Settings with Exercise/Circuit management.

---

## 17.2 Settings Layout

Conceptual layout:

```text
┌────────────────────────────────┐
│ Settings                       │
│                                │
│ WORKOUT                        │
│                                │
│ Weight Unit                    │
│ Pounds (lb)               ›    │
│                                │
│ DATA & BACKUP                  │
│                                │
│ Local data only                │
│ Last backup: Oct 18, 2026      │
│                                │
│ [ Export Backup ]              │
│ [ Import Backup ]              │
│                                │
│ STORAGE                        │
│                                │
│ Persistent storage: Enabled    │
│                                │
│ ABOUT                          │
│                                │
│ WtReps                         │
│ Version 1.x                    │
│                                │
├────────────────────────────────┤
│ Home  History  Manage Settings │
└────────────────────────────────┘
```

---

# 18. Weight Unit Setting

Provide a global weight-unit preference:

```text
Pounds (lb)
Kilograms (kg)
```

Default:

```text
Pounds (lb)
```

Changing the global unit should affect future WorkoutExercise snapshots and Exercises without an override.

Do not automatically rewrite historical Workouts.

---

# 19. Rest Timer Setting

Rest Timer is optional for Version 1.

If not implemented, omit the control completely.

Do not show a disabled placeholder for an unfinished feature.

If implemented later:

```text
Rest Timer
Off / On

Default Rest
90 seconds
```

---

# 20. Data & Backup

Because Version 1 has no backend, Settings should clearly communicate:

```text
Local data only
```

Include brief supporting text:

> Your workout data is stored on this device. Export a backup periodically to protect your history.

Avoid alarming language, but make the backup model understandable.

---

# 21. Export Backup

The browser download uses a JSON Blob, a native download link, and a temporary URL
revoked after the download handler has had time to consume it. Feedback and the last
backup date mean download initiation, not proof that the user saved the file. Verify
the installed iPhone PWA's file handling before release. No remote service is used.

Primary backup action:

```text
Export Backup
```

The button should:

1. read all persistent WtReps data,
2. build the versioned JSON export,
3. validate it,
4. initiate browser download/share behavior,
5. update `lastExportAt` after successful export initiation.

Suggested filename:

```text
wtreps-backup-2026-10-18.json
```

Use local calendar date in the filename.

---

# 22. Export Success

Do not use a modal success dialog.

Use a lightweight message:

```text
Backup exported
```

and update:

```text
Last backup: Today
```

or:

```text
Last backup: Oct 18, 2026
```

---

# 23. Last Backup

If `lastExportAt` is null:

```text
No backup created yet
```

If available:

```text
Last backup: Oct 18, 2026
```

This is informational only.

Do not nag the user in Version 1 unless later testing suggests reminders are useful.

---

# 24. Import Backup

Use:

```text
Import Backup
```

to open the system file picker.

Only accept JSON files where practical.

After selecting a file:

1. parse JSON,
2. validate schema,
3. validate references,
4. show replacement confirmation,
5. replace data only after confirmation.

Existing data must remain unchanged if validation fails.

---

# 25. Import Confirmation

Version 1 import replaces all existing WtReps data.

Confirmation should be explicit:

```text
Import Backup?

This will replace all current WtReps data on this device.

Your current data will be permanently removed unless you export it first.

[ Cancel ]

[ Replace Data ]
```

If the user has not exported recently, an optional secondary action may be:

```text
Export Current Data First
```

but this is not required.

---

# 26. Import Validation Failure

If the JSON file is invalid:

```text
Could not import backup

This file is not a valid WtReps backup or uses an unsupported format.

Your current data was not changed.

[ OK ]
```

Do not partially import anything.

---

# 27. Import Success

After successful replacement:

```text
Backup restored
```

The app should then refresh from IndexedDB.

If an active Workout from the old data was replaced, ensure the UI reflects the imported database state.

---

# 28. Storage Section

WtReps should request persistent browser storage where supported.

Settings may show:

```text
Storage

WtReps data is stored on this device.

Persistent storage: Enabled
```

Possible values:

- Enabled
- Not enabled
- Not supported

Avoid exposing technical terms such as IndexedDB unless needed for troubleshooting.

---

# 29. Persistent Storage Request

Version 1 checks persistence status when Settings opens and requests it only from
the explicit Request Persistent Storage action. A denial/error disables repeat
requests for that Settings visit; there is no automatic prompt on every launch.
Denial never blocks the app. Clear All Data remains optional and is deferred.

Do not repeatedly prompt or annoy the user.

The app may request persistent storage:

- after meaningful data exists,
- during initial setup,
- or from Settings.

If the browser refuses persistence, WtReps should continue working normally.

The JSON backup remains the durability mechanism.

---

# 30. Clear All Data

A Clear All Data control is optional.

If implemented, place it at the very bottom of Settings in a destructive section.

Example:

```text
DANGER ZONE

Clear All WtReps Data
```

Confirmation:

```text
Clear all WtReps data?

This will permanently delete:

• exercises
• circuits
• workout history
• settings

This cannot be undone unless you have a backup.

[ Cancel ]
[ Clear All Data ]
```

This feature may be deferred if not needed initially.

---

# 31. About Section

Keep About minimal.

Example:

```text
WtReps
Version 1.0.0

Local-first workout tracking
```

No need for a separate About route in Version 1 unless useful later.

---

# 32. Offline Behavior

WtReps must behave normally when offline.

Do not show disruptive warnings merely because the network is unavailable.

A subtle indicator may be used if helpful:

```text
Offline
```

However, because Version 1 has no backend, offline status has little functional impact once the PWA shell is cached.

Do not imply that Workout saving depends on connectivity.

---

# 33. First Offline Launch Limitation

The PWA can only launch offline after its application assets have previously been loaded/cached.

The UI does not need to explain service-worker mechanics.

After successful installation/load, normal offline use should require no special interaction.

---

# 34. App Loading State

When opening IndexedDB, do not briefly show incorrect empty states.

Use a neutral loading state:

```text
WtReps

Loading...
```

or a minimal skeleton.

Avoid elaborate spinners.

---

# 35. Database Load Failure

If IndexedDB fails to initialize:

```text
WtReps couldn't load your workout data.

Your browser's local storage may be unavailable.

[ Retry ]
```

Do not show the normal "No circuits yet" empty state.

That could incorrectly imply the user's data is gone.

---

# 36. Save Failure During Workout

Persistence failure during an active Workout is high priority.

Example:

```text
WtReps could not save this change.

Your workout may not be fully saved.

[ Retry ]
```

Do not silently ignore IndexedDB errors.

A persistent error banner is preferable to a transient toast for serious storage failures.

---

# 37. Routine Success Feedback

Use lightweight feedback for low-frequency configuration actions:

```text
Exercise saved
Circuit saved
Workout updated
Backup exported
Backup restored
```

Avoid success modals.

Do not show a toast after every completed Set.

---

# 38. PWA Update State

If a new version becomes available while no Workout is active:

```text
A WtReps update is available.

[ Update ]
```

If a Workout is active:

- do not force reload,
- defer updating until after Workout completion.

Potential subtle message:

```text
Update available
```

but it should not interrupt the Workout.

---

# 39. Destructive Action Rules

Use confirmation for meaningful permanent loss:

- delete Workout,
- delete Circuit,
- delete Exercise,
- replace data through Import,
- abandon active Workout,
- clear all data.

Avoid confirmation for lightweight reversible operations:

- remove Exercise from Circuit,
- remove a Set while editing before Save,
- reorder items.

Prefer Undo where practical for lightweight deletion.

---

# 40. Bottom Navigation

Outside focused detail/edit/workout flows:

```text
Home | History | Manage | Settings
```

Use icon + text label.

Do not use icon-only navigation.

Hide or minimize bottom navigation during:

- Active Workout,
- historical Workout editing,
- potentially other focused editors where screen space matters.

---

# 41. Desktop Behavior

Mobile is the source design.

Desktop should enhance rather than redefine it.

Recommended maximum widths:

- general forms: about 600–700px,
- Circuit/editor/history detail: about 700–800px,
- Home may use a slightly wider container or two-column Circuit grid.

Avoid full-width stretched forms.

The Active Workout screen may remain intentionally narrow on desktop.

---

# 42. Styling Approach

Prefer:

- component-scoped Svelte CSS,
- global design tokens,
- CSS custom properties,
- simple reusable primitives.

Avoid requiring a heavy component framework.

Suggested design tokens:

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

Use spacing and typography to establish hierarchy before adding heavy borders/cards.

---

# 43. Loading and Empty State Rule

Distinguish between:

- data loading,
- genuinely empty database,
- database failure.

Never show an empty-state creation prompt until data loading has completed successfully.

---

# 44. Keyboard Behavior

The software keyboard should not obscure important fields or actions.

For Set entry:

- keep active input visible,
- numeric keyboard,
- keyboard appears only after tapping an input.

For Exercise/Circuit forms:

- normal form behavior is acceptable,
- Save should remain reachable through scrolling.

---

# 45. Focus Behavior

When adding a Set, WtReps may focus an input if testing shows this is faster.

Do not automatically focus fields during ordinary Exercise navigation.

Machine settings are reference information during Workouts and should never trigger keyboards.

---

# 46. Error Language

Use plain language.

Good:

```text
WtReps could not save this change.
```

Avoid:

```text
IndexedDB transaction rejected.
```

Technical detail may be logged to the developer console, not shown as the primary user message.

---

# 47. Core Component Inventory

Likely reusable Svelte components include:

```text
AppHeader
BottomNav
ActiveWorkoutCard
CircuitCard
ExerciseListItem
CircuitListItem
ExerciseSettingEditor
CircuitExerciseRow
WorkoutSetCard
MachineSettings
PreviousPerformance
WorkoutNavigation
WorkoutHistoryItem
WorkoutExerciseHistorySection
Toast
ConfirmDialog
ErrorBanner
```

Avoid splitting trivial markup into separate components without a clear reuse or clarity benefit.

---

# 48. Suggested Route Map

Possible route structure:

```text
/
```

Home.

```text
/manage
```

Manage landing.

```text
/exercises
```

Exercise list.

```text
/exercises/new
```

Create Exercise.

```text
/exercises/[id]
```

Edit Exercise.

```text
/exercises/[id]/history
```

Exercise History.

```text
/circuits
```

Circuit list.

```text
/circuits/new
```

Create Circuit.

```text
/circuits/[id]
```

Edit Circuit.

The Exercise picker is an in-editor view at `/circuits/new` or `/circuits/[id]`,
not a separate route (see section 11.4).

```text
/workout/[id]
```

Active Workout.

```text
/workout/[id]/summary
```

Workout Summary.

```text
/history
```

Workout History.

```text
/history/[id]
```

Workout Detail.

```text
/history/[id]/edit
```

Edit historical Workout.

```text
/settings
```

Settings / backup / storage.

Exact routes may change during implementation if a simpler structure emerges.

---

# 49. Core UX Rule

The primary interaction should feel like:

```text
Look at screen
↓
Set machine
↓
Lift
↓
Record result
↓
Next machine
```

Anything that interrupts that rhythm should be questioned.

---

# 50. Version 1 UI Philosophy

WtReps should feel like a focused workout tool rather than a general fitness platform.

The most important screen should answer three questions immediately:

1. What Exercise am I doing?
2. How do I set up the machine?
3. What weight/reps should I start with?

Every screen and interaction should support the central product goal:

> Make recording a machine-based strength workout nearly effortless.
