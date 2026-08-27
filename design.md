# Storage & Duplicate Cleaner — Mobile Interface Design

## Product direction

Storage & Duplicate Cleaner is a privacy-first utility that makes storage cleanup feel calm, understandable, and reversible. The interface follows mainstream iOS conventions: portrait-first layouts, one-handed reachability, clear hierarchy, familiar navigation, generous spacing, and destructive actions that are explicit rather than surprising.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| Home | Storage summary, cleanup opportunity total, last scan status, primary “Scan my device” action, and category cards for duplicates, large files, and temporary files. |
| Scan | Scan progress, current category, animated progress indicator, files examined, and a cancel action. The scan ends in Results. |
| Results | Grouped cleanup opportunities with selectable rows, estimated reclaimable storage, filter chips, and a bottom action to review or clean selected items. |
| Cleanup review | Confirmation sheet showing selected items, reclaimed-space estimate, privacy reassurance, and a clearly labeled destructive cleanup action. |
| Cleanup complete | Success state with reclaimed storage, summary of removed categories, and actions to return home or view results. |
| Settings | Local-only privacy statement, scan preferences, notification preference placeholder, subscription entry point, restore purchases action, and app information. |
| Premium | Freemium comparison with monthly, yearly, and lifetime options, plus restore purchases. Purchase integration remains behind a service boundary until credentials/products are configured. |

## Key user flows

### First scan

1. The user opens Home and reviews the storage summary.
2. The user taps “Scan my device.”
3. Scan displays progress and the current category being analyzed.
4. When complete, the user lands on Results with grouped recommendations.
5. The user selects categories or individual items and taps “Review cleanup.”
6. Cleanup review explains exactly what will be removed.
7. The user confirms, sees a success state, and can return to Home.

### Reviewing duplicates

1. The user taps the Duplicates category card on Home or Results.
2. The user reviews grouped duplicate sets with file names, sizes, and selection state.
3. The app keeps one suggested original per group and lets the user change selections.
4. The user reviews the reclaimable total before confirming cleanup.

### Exploring premium

1. The user taps an advanced feature or the premium entry point in Settings.
2. Premium presents a concise value comparison and plan cards.
3. The user chooses a plan, which calls a purchase service boundary.
4. The user can restore purchases without creating an account.

## Visual system

| Element | Choice |
|---|---|
| Brand primary | Deep indigo `#4F46E5`, used for main actions and progress. |
| Brand secondary | Electric violet `#7C3AED`, used sparingly for premium accents. |
| Positive state | Emerald `#10B981`, used for reclaimed space and completed scans. |
| Warning state | Amber `#F59E0B`, used for large-file attention states. |
| Background | Soft slate `#F6F7FB` in light mode and near-black `#111318` in dark mode. |
| Surface | White `#FFFFFF` in light mode and charcoal `#1B1E27` in dark mode. |
| Text | Ink `#111827` / soft white `#F8FAFC`, with slate-muted secondary text. |
| Shape | 16–24 pt rounded cards, pill filters, and 14 pt primary buttons. |
| Typography | System sans-serif with large numerical storage figures, strong screen titles, and readable 15–16 pt body copy. |

## Interaction principles

Primary actions use subtle scale and opacity feedback plus light haptics where available. Destructive cleanup always requires a review step. Long lists use performant list primitives. Every screen has a clear escape path, and the app avoids requiring authentication or cloud storage for the local scanning experience.
