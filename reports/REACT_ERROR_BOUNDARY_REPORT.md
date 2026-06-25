# React Error Boundary Report
**Date:** 2026-06-02
**File:** `client/components/ErrorBoundary.tsx`

---

## What It Does

Catches JavaScript render-time errors that would otherwise crash the React tree and show a blank white screen. Displays a user-friendly recovery UI instead.

---

## Placement

Wraps the entire `App` component tree in `App.tsx`:
```tsx
<ErrorBoundary context="app-root">
  <BrowserRouter>
    <AuthProvider>
      ...all routes...
    </AuthProvider>
  </BrowserRouter>
</ErrorBoundary>
```

This catches:
- Component render errors
- Unexpected runtime errors in components
- Missing prop crashes

---

## Recovery UI

Shows:
- Friendly "Something went wrong" message
- Random error ID (8-char hex) for support reference — NOT a full stack trace
- "Try again" button (resets error state, re-renders children)
- "Reload page" button (full refresh)

Does NOT show:
- Stack traces
- Component names
- Internal error details
- API keys or secrets

---

## Sentry Integration

`componentDidCatch(error, info)` calls:
```typescript
captureClientException(error, {
  componentStack: info.componentStack,
  context: this.props.context,
  errorId: this.state.errorId,
});
```

This sends the crash to Sentry with component stack info (no-op if Sentry not configured).

---

## Usage for More Granular Boundaries

Can be used on individual sections:
```tsx
<ErrorBoundary context="admin-route-planner" fallback={<p>Route planner unavailable</p>}>
  <AdminRoutePlanning />
</ErrorBoundary>
```

The `fallback` prop accepts any ReactNode for section-specific recovery UIs.
