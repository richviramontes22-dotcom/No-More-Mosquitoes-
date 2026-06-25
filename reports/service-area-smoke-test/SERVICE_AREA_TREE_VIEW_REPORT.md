# Service Area Tree View Report
Generated: 2026-06-16

## Component: `client/pages/admin/ServiceAreas.tsx`

## Structure Verification

### California Root Node
- Header renders `<MapPin /> California` with total active/total ZIP counter ✓
- Loading spinner in header while fetching ✓

### County Groups
| County | In COUNTY_ORDER | Color Class | Renders when data present |
|---|---|---|---|
| Los Angeles | YES | `bg-blue-500/10 text-blue-700` | YES (ordered first) |
| Orange | YES | `bg-orange-500/10 text-orange-700` | YES |
| Riverside | YES | `bg-purple-500/10 text-purple-700` | YES |
| San Bernardino | YES | `bg-rose-500/10 text-rose-700` | YES (after SB migration) |
| San Diego | YES | `bg-cyan-500/10 text-cyan-700` | YES |
| Unknown/Other | N/A | `bg-muted/30 text-foreground` | Appended after known counties |

### County Row Features
- Chevron toggle (Right when collapsed, Down when expanded) ✓
- County name with "(County)" suffix ✓
- Badge showing `active/total` with county color ✓
- Progress bar via `pctBar(active, total)` with color tiering (green → amber → gray) ✓
- "All on" / "All off" bulk buttons with disabled state when already at target ✓
- Spinner replaces button text during batch save ✓

### ZIP Rows (when expanded)
- Indented under county with `ml-5` ✓
- Monospace ZIP code, city name, Switch toggle ✓
- Spinner replaces Switch during individual save ✓
- Hover highlight ✓

### Expand/Collapse Logic
- `expandedCounties: Set<string>` — correct immutable set update pattern ✓
- `toggleExpanded()` creates new Set to trigger re-render ✓
- `focusCounty()` adds to expanded set + `setTimeout(50ms)` → `scrollIntoView({behavior:"smooth"})` ✓

### Counts Display
- `orderedCounties` computed via `useMemo` — known counties first in COUNTY_ORDER, then unknown sorted alphabetically ✓
- Empty-county filtering: `COUNTY_ORDER.filter(c => byCounty[c]?.length)` ✓

## Bulk Actions Verification
```typescript
const toggleCounty = async (county: string, active: boolean) => {
  const targets = (byCounty[county] ?? []).filter(a => a.is_active !== active);
  if (targets.length === 0) return;  // no-op if already at target state ✓
  ...
  const res = await adminApi("/api/admin/service-areas/batch-update", "POST", { ids, is_active });
  const updated = new Map<string, ServiceArea>(...);
  setAreas(prev => prev.map(a => updated.has(a.id) ? updated.get(a.id)! : a));  // instant UI update ✓
}
```

- "All on" disabled when `active === total` ✓
- "All off" disabled when `active === 0` ✓
- UI updates optimistically from API response (no stale UI) ✓
- Toast notification on success ✓
- Toast notification on error ✓

## State Management
- `areas` list mutated only via `setAreas()` returning new arrays ✓
- `batchSaving: string | null` — tracks which county is currently batch-saving ✓
- `savingIds: Set<string>` — tracks individual ZIP saves ✓
- No stale closure issues (all state updates use functional form `prev =>`) ✓

## Status: PASS
