# DetailedLocationList – Performance Analysis & Improvement Proposals

This document identifies the main performance sinks in the **DetailedLocationList** flow (including data loading in **DetailedLocationViewModal**) and proposes improvements with ease-of-execution and expected gain.

---

## Data flow (where “loading” happens)

1. **DetailedLocationViewModal** subscribes to `gameStateController` and `proximityComputationController` via `useSyncExternalStore`.
2. A **single `useMemo`** builds `ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData>` by iterating over `gameState.ownedLocations` and, **for each location**, calling:
   - `ConstructibleHelper.getNewConstructibleState(key, gameData, gameState)`
   - `ProximityComputationHelper.evaluationToProximity(proximityComputation.result[key]?.cost ?? 100)`
   - A small `reduce` for `harborSuitability`.
3. **DetailedLocationList** receives `ownedLocations` and, in its own `useMemo`, sorts and splits into `pinnedItems` and `sortedItems`, then renders **every row** (no virtualization).

---

## Main performance sinks

### 1. Full recompute of `ownedLocations` on any store update (High impact)

**What happens:**  
The modal’s `useMemo` depends on `[gameData, gameState, pinnedLocations, proximityComputation, search]`.  
`gameStateController` and `proximityComputationController` use the base `Observable`, which does:

```ts
this.cachedSnapshot = { ...this.subject } as T;
```

So **every** `notifyListeners()` produces a **new object reference** for `gameState` and for `proximityComputation`. Any change (capital, roads, buildings, temporary data, proximity run) therefore invalidates the memo and **recomputes the entire `ownedLocations` map** for all owned locations.

**Effect:**  
- N × `getNewConstructibleState(...)` (N = number of owned locations)  
- N × proximity lookup + harbor reduce  
- Then full re-render of the list

**Ease:** Medium (needs selector pattern or splitting deps)  
**Gain:** High (avoids most redundant work when unrelated parts of state change)

---

### 2. `ConstructibleHelper.getNewConstructibleState` per location (High impact)

**What happens:**  
For each location this helper:

- Calls `partitionTemplatesByFamily(gameData.buildingsTemplate)` (same for every location).
- Calls `getRepresentativeTemplateNamesPerFamily(...)` and filters templates.
- Calls `getEligibleBuildingTemplates(...)`, which for each candidate template:
  - Builds a logic tree (`getBuildingSupportabilityLogicTree`) and calls `evaluateLogicTree(tree)`.
- Then builds `NewConstructibleState` (possible actions, instance refs).

So cost is **O(L × (T + T×logicTree))** where L = locations, T = building templates. This runs whenever the big `useMemo` runs (see sink 1).

**Effect:**  
Dominant CPU cost when the modal is open and state or proximity updates.

**Ease:** Medium–High (caching, moving shared work out of the per-location loop, or memoizing per location)  
**Gain:** High (biggest single computation in this flow)

---

### 3. No list virtualization (Medium impact)

**What happens:**  
All pinned rows plus all sorted rows are rendered as real DOM. Each row has 8 columns; the “Buildings” column renders one `DisplayBuilding` (image, tooltip, buttons) per building. So **total components/DOM nodes ≈ locations × (fixed columns + buildings per location)**.

**Effect:**  
With many locations and many buildings, large DOM and many React elements, leading to slower render and scroll.

**Ease:** Medium (add a virtual list; keep sticky header and pinned section behavior)  
**Gain:** High for large lists (smoother scroll, faster initial render)

---

### 4. `console.log` in render path (Low–medium impact)

**Where:**  
- `detailedLocationList.component.tsx` ~296: inside `DisplayBuildings` map, `console.log(\`[DetailedLocationList] instance for building ${buildingTemplateName}\`, instance)` for every building of every location on every render.
- `shortestPath.component.tsx` ~56: `console.log({ locationResult })` on each render/update.

**Effect:**  
Allocations and I/O on every list render; can be heavy in dev and still run in prod if not stripped.

**Ease:** Trivial (remove or guard with `process.env.NODE_ENV`)  
**Gain:** Low–medium (cleaner profiles, less noise, safer prod)

---

### 5. Sort + split in two passes (Low impact)

**What happens:**  
In **DetailedLocationList**, the `useMemo` does:

- `Object.entries(props.ownedLocations).sort(...)`  
- Then two `filter` + `Object.fromEntries`: one for pinned, one for unpinned.

So one sort and two full passes over the sorted array.

**Effect:**  
Minor extra work; could be one pass that splits while iterating.

**Ease:** Easy  
**Gain:** Low (small constant factor)

---

### 6. Broad dependency: `pinnedLocations` (Low–medium impact)

**What happens:**  
`togglePin` is wrapped in `useCallback(..., [pinnedLocations])`. `pinnedLocations` is a `Set` whose reference changes on every pin/unpin. That dependency is in the modal’s big `useMemo`, so **every pin/unpin** triggers a full recompute of `ownedLocations` (all locations, all `getNewConstructibleState`, etc.).

**Effect:**  
Unnecessary heavy work on pin/unpin; only the `pinned` flag per location actually changes.

**Ease:** Easy (stabilize callback and/or derive “pinned” when building entries so the memo doesn’t depend on the Set reference for the heavy part)  
**Gain:** Medium when users pin/unpin often

---

## Summary table

| Sink | Impact | Ease | Gain |
|------|--------|------|------|
| 1. Full recompute on any store update | High | Medium | High |
| 2. getNewConstructibleState × N | High | Medium–High | High |
| 3. No virtualization | Medium | Medium | High (for large N) |
| 4. console.log in render | Low–Medium | Trivial | Low–Medium |
| 5. Sort + two passes | Low | Easy | Low |
| 6. pinnedLocations in useMemo deps | Low–Medium | Easy | Medium |

---

## Recommended improvements (by priority)

### Quick wins (do first)

1. **Remove or guard debug logs**  
   Remove the `console.log` in `DisplayBuildings` and in `ShortestPathComponent`, or wrap in `if (process.env.NODE_ENV === 'development')`.  
   **Ease:** Trivial | **Gain:** Low–medium

2. **Reduce recompute on pin/unpin**  
   - Option A: Build `ownedLocations` without `pinned` in the heavy `useMemo` (e.g. from `gameState` + `gameData` + `proximityComputation` + `search` only). Add `pinned: pinnedLocations.has(key)` when **rendering** or in a light second step that only depends on `pinnedLocations` and the base map.  
   - Option B: Keep building `pinned` in the memo but use a **stable** dependency for “which locations are pinned” (e.g. a sorted string of pinned ids) so the reference doesn’t change every time the Set is recreated.  
   **Ease:** Easy | **Gain:** Medium

3. **Single-pass sort + split**  
   In **DetailedLocationList**, do one sorted iteration and push into `pinned` and `unpinned` arrays, then build `pinnedItems` / `sortedItems` from those.  
   **Ease:** Easy | **Gain:** Low

### Medium effort, high gain

4. **Stabilize modal `useMemo` dependencies (selector-style)**  
   - Don’t depend on the whole `gameState` object. Depend only on the slices that actually affect the list: e.g. `gameState.ownedLocations`, `gameState.temporaryLocationData`, `gameState.capitalLocation`, `gameState.roads`, etc.  
   - Use a small helper or `useSyncExternalStore` with a custom `getServerSnapshot`/`getClientSnapshot` that returns only those slices (or a hash of them) so the memo doesn’t recompute when e.g. only `country` or unrelated fields change.  
   **Ease:** Medium | **Gain:** High (fewer full recomputes)

5. **Cache or share work inside constructible state**  
   - **Share `partitionTemplatesByFamily` result:** Compute once per `gameData.buildingsTemplate` (e.g. in a small memo or module-level cache keyed by template version), and pass the result into `getNewConstructibleState` (or a variant) so each location doesn’t recompute it.  
   - **Memoize per location:** Cache `getNewConstructibleState(key, …)` by `key` and a digest of `gameState` (e.g. `ownedLocations[key]`, `temporaryLocationData[key]`, `roads`, `capitalLocation`) so you only recompute when that location’s inputs change.  
   **Ease:** Medium–High | **Gain:** High

6. **Virtualize the list**  
   Use a virtual list (e.g. `react-window`, `@tanstack/react-virtual`) for the “sorted” rows only; keep the sticky header and the sticky pinned block as regular DOM. Ensure row height is consistent or use a dynamic-height virtual list so sorting and pinning still look correct.  
   **Ease:** Medium | **Gain:** High for large location counts

### Longer-term / structural

7. **Selector-based subscriptions**  
   Move to a store/controller API that supports selectors (e.g. `useSyncExternalStore` with a snapshot that’s derived from selected fields) so the modal only re-runs its heavy memo when `ownedLocations`, `temporaryLocationData`, `roads`, `capitalLocation`, or proximity result actually change.  
   **Ease:** Higher (touches Observable/store pattern) | **Gain:** High and durable

8. **Lazy load / compute constructible state**  
   Don’t compute `constructibleState` for every location up front. Either compute it on first expand or when the row becomes visible (e.g. in the virtual list), or move it to a worker and stream results. Keeps same functionality with less upfront work.  
   **Ease:** High | **Gain:** High for initial open and for large N

---

## Functionality to preserve

- Same columns, sorting, pinning, search, and capital/pin actions.
- Proximity and pathfinding tooltip behavior (on-demand is already good).
- Editable development/population and building actions.
- Sticky header and sticky pinned section; virtualization should only apply to the non-pinned sorted list.

If you tell me which of these you want to implement first (e.g. “quick wins only” or “virtualization + dependency stabilization”), I can outline concrete code changes in the relevant files.
