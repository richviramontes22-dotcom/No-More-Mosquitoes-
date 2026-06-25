# Admin Route Operations Tutorial
**Audience:** Non-technical admin/office staff
**Where to find this:** Admin Portal → Route Planning (`/admin/route-planning`)

This guide walks through everything you need to plan, review, and send out technician routes for the day.

---

## 1. What route optimization does

Every day, technicians need to visit a list of customer properties. Instead of you manually figuring out the best order to visit them in, the system calculates an efficient order automatically — grouping nearby stops together and minimizing drive time between them. This is what "generating a route" or "day plan" means.

The system does this using straight-line distance and a basic speed estimate (no live traffic, no paid mapping service) — so it's a strong starting point, not a perfect GPS-grade route. That's exactly why admin review (Section 3) matters.

## 2. What Smart Optimize does

Smart Optimize is an upgrade to the basic route order. It takes the technician's home base location into account (so they don't backtrack across town to reach their first stop), uses more realistic speed estimates for short vs. long drives, and respects each technician's daily drive-time limit if one is set.

Smart Optimize always shows you a **preview** first — distance saved, time saved, and the new stop order — before anything changes. Nothing is applied until you click "Apply New Order."

## 3. Why admin review is required

The system does not know about real-world details a human does — a customer who called to request a morning slot, a road closure, a technician running behind. That's why every route is created in **draft** status and nothing reaches a technician's phone until an admin explicitly clicks Publish. Review is your chance to catch anything that looks off before a technician's day is built around it.

## 4. How to generate a day plan

1. Go to **Route Planning** → make sure the **Day Planner** tab is selected (it's the default).
2. Pick the date at the top.
3. Click **Generate Day Plan**.
4. The system finds every scheduled appointment for that date, groups them by ZIP code, and assigns each group to an available technician (skipping anyone on a blackout day or already at capacity). A route card appears for each technician.

If some appointments couldn't be assigned, they'll show up in an amber **Unassigned** card below the route list — check why (no available technician, capacity full, etc.) before publishing the rest.

## 5. How to run Smart Optimize

1. On any route card (or in the Single Technician tab), click the violet **Smart** button.
2. A preview opens showing the proposed new stop order, the percentage improvement, and miles/minutes saved.
3. Stops using an estimated (not exact) address location are flagged **"est. geo"**. Stops beyond the technician's drive-time limit are flagged **"cap"**.
4. If you're happy with the proposed order, click **Apply New Order**. If not, click **Keep Current** — nothing changes.

Smart Optimize works best once technicians have a home base location set (Section 11). Without it, the route still starts from whichever stop happens to be first in the list.

## 6. How to read route warnings

Each route card shows a confidence badge:
- **High confidence** (green) — real address coordinates for all/most stops.
- **Medium confidence** (amber) — a mix of real and estimated coordinates.
- **Low confidence** (red) — mostly estimated coordinates; treat the stop order as a rough guess.

An amber box reading "X coordinate warning(s)" means some stops don't have a verified location yet (usually a new property that hasn't been geocoded). This isn't necessarily wrong — but it's worth a glance at the addresses before publishing.

## 7. How to manually reorder stops

Open a route in the **Single Technician** tab to see its full stop list. You can adjust sequence or add notes per stop directly. Every manual change is recorded in the route's audit history automatically — you don't need to do anything extra for that.

## 8. How to approve routes

Once a draft route looks right, click **Approve** (on the card) or **Approve Route** (in Single Technician view). Approval doesn't lock anything in — you can still Smart Optimize or rebuild an approved route. It's a checkpoint marking "I've reviewed this."

For the whole day at once, use **Approve All** at the top of the Day Planner tab.

## 9. How to publish/send routes to employees

Click **Publish** on a route card, or **Publish & Notify Employee** in Single Technician view, or **Publish All** to send every ready route for the day at once.

A confirmation window will open showing the route's confidence and any warnings before anything is sent. If there are unresolved warnings, the confirm button changes to **Force Publish Anyway** — a second, deliberate click — so you can't publish a flagged route by accident.

Once published, the technician will see the route the next time they open their app. There's no SMS or push alert sent to them (yet) — they check the app each morning.

## 10. How to configure service areas

Go to **Admin → Service Areas**. This is where ZIP codes are marked active/inactive per county, and where the coverage map lives. This controls which addresses can get an instant quote on the public site — it's separate from route planning, but routes can only be generated for appointments that came from an active service area.

## 11. How to configure technician home bases

Go to **Admin → Workforce → Capacity**, pick a technician from the list on the left, and scroll to **Vehicle & Home Base**. Fill in:
- **Home base / Depot address** — for your own reference (not used by the routing math).
- **Home base latitude** and **Home base longitude** — this is what Smart Optimize actually uses as the starting point.

To find the coordinates: open Google Maps, find the depot/warehouse location, right-click the exact spot, and click the coordinates at the top of the menu to copy them (they look like `33.6846, -117.8265` — the first number goes in Latitude, the second in Longitude).

Until this is filled in for a technician, Smart Optimize still works, it just can't account for their home base — the savings shown in the preview will be smaller than they could be.

## 12. How to handle out-of-area leads

If a quote request or signup comes from a ZIP code outside an active service area, it won't get an instant price — it'll be flagged for manual follow-up in the Lead Inbox (**Admin → Leads**). Check there periodically for any address near the edge of your coverage map that might be worth adding as a new active ZIP.

## 13. What not to do

- **Don't Force Publish routinely.** It exists for genuine exceptions (e.g., you've manually verified a flagged address is correct). If you're forcing publishes often, the underlying data problem (missing coordinates, missing home base) should be fixed instead.
- **Don't rebuild a published or in-progress route.** The system blocks this on purpose — a technician may already be using it.
- **Don't edit service area ZIPs and expect existing routes to update.** Service areas only affect new quotes/leads, not routes already generated.
- **Don't expect technicians to receive a notification the instant you publish.** There's no SMS/push yet — they see updates when they open the app.

## 14. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| "No assignments found" when generating a route | No scheduled appointments for that tech/date | Check the Appointments page for that date |
| A technician is missing from the day plan | They're on a blackout date, inactive, or already have a draft/approved route for that date | Check Workforce → Schedules; discard the existing draft if you want to regenerate |
| Smart Optimize shows little or no improvement | Home base isn't set, or the stops were already in a good order | Set the technician's home base coordinates (Section 11) |
| Publish button says "Force Publish Anyway" | The route has low confidence or coordinate warnings | Review the warning list in the popup; if it looks fine, click again to force-publish |
| A published route looks wrong after the fact | Coordinates may have been estimated (mock geo) for a new address | Check Service Areas / property record for a missing address geocode |
