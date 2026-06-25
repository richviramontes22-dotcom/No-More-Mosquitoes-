# Employee Message Persistence Fix Report
**Date:** 2026-05-31

## Problem

`server/routes/employeeMessages.ts` was using in-memory storage for message threads. Messages sent through this route were lost on server restart and invisible in the UI (which reads directly from Supabase).

The actual client code (`AssignmentDetail.tsx` and `Messages.tsx`) already read/wrote messages directly to Supabase. The server route was dead code with a separate inconsistent data store.

## Fix

`server/routes/employeeMessages.ts` completely rewritten to use Supabase.

### Key changes:

**Authentication:** Added `getAuthEmployee(req)` helper. Routes now require a valid JWT Bearer token.

**GET /api/employee/messages?assignment_id=...**
- Verifies employee owns the assignment before returning messages
- Queries `message_threads` and `messages` from Supabase
- Returns empty array (not 404) if no thread yet — consistent with client expectations

**POST /api/employee/messages**
- Verifies employee owns assignment
- Gets or creates `message_threads` row with `customer_visible: true`
- Inserts message to `messages` table with `direction: outbound`, `channel: in_app`
- Updates `last_activity_at` on thread
- Returns created message record

## Result

The server route now reads/writes from the same Supabase tables the client already uses. No data inconsistency possible. Route is now usable by any API consumer (future native app, etc.).

## Files Changed
- `server/routes/employeeMessages.ts` — full rewrite
