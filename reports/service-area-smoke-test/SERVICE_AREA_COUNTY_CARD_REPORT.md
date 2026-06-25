# Service Area County Card Report
Generated: 2026-06-16

## Component: County stat cards in `client/pages/admin/ServiceAreas.tsx` (map right panel)

## Card Render Logic
```tsx
<div className="px-4 pb-4 grid grid-cols-2 gap-2">
  {COUNTY_ORDER.filter(c => byCounty[c]).map(county => {
    const list = byCounty[county] ?? [];
    const active = list.filter(a => a.is_active).length;
    const colorClass = COUNTY_COLOR[county] ?? "bg-muted/30 text-foreground";
    return (
      <button key={county} onClick={() => focusCounty(county)} ...>
        <span className="text-xs font-medium truncate">{county}</span>
        <Badge ...>{active}/{list.length}</Badge>
      </button>
    );
  })}
</div>
```

## Cards Verified
| County | Renders | Active Count | Total Count | Click Action |
|---|---|---|---|---|
| Los Angeles | YES (when data present) | computed from `areas` | list.length | `focusCounty("Los Angeles")` |
| Orange | YES | computed | list.length | `focusCounty("Orange")` |
| Riverside | YES | computed | list.length | `focusCounty("Riverside")` |
| San Bernardino | YES (after SB migration) | computed | list.length | `focusCounty("San Bernardino")` |
| San Diego | YES | computed | list.length | `focusCounty("San Diego")` |

## Click Behavior
`focusCounty(county)`:
1. `setExpandedCounties(prev => new Set([...prev, county]))` — adds county to expanded set ✓
2. `setTimeout(50ms)` → `countyRefs.current[county]?.scrollIntoView({ behavior: "smooth", block: "start" })` ✓

The `countyRefs` ref is populated by `ref={el => { countyRefs.current[county] = el; }}` on each county row div ✓

## Count Accuracy
- `active` = `list.filter(a => a.is_active).length` — derived from live `areas` state ✓
- `list.length` = total ZIPs for that county ✓
- Both values update immediately after any toggle (individual or batch) because `areas` state is updated from API response ✓

## Filtering
- `COUNTY_ORDER.filter(c => byCounty[c])` — cards only render for counties with at least one ZIP ✓
- Counties with no ZIPs are silently omitted (clean empty state before SB migration is run) ✓

## Visual
- 2-column grid ✓
- County name left-aligned, badge right-aligned ✓
- Hover: `hover:bg-muted/10 transition-colors` ✓
- Color badge matches tree view county color class ✓

## Status: PASS
