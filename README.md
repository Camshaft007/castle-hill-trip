# Castle Hill Dawn Patrol

A trip dashboard for Scribe, Kaos, No-Plan and Camshaft — splitboarding the Castle Hill / Craigieburn backcountry, Canterbury NZ.

No build step, no backend — just static HTML/CSS/JS, built to run well on a phone with patchy signal.

## What's in it

- **Overview** — set the departure date/time and get a live countdown, plus a shared "what we're bringing" note for accommodation.
- **Checklist** — Anna's AKG/Chill "Introduction to Touring" gear list (avalanche safety, touring gear, clothing, essentials, pack), split into categories. Tap a name to assign who's carrying it, tick it off once it's packed.
- **Costs** — log an expense and who paid; the app splits it four ways and works out who owes who, simplified to the fewest transfers.
- **Conditions** — direct links to the real avalanche/weather/road sources (no live data is fetched — see below), plus a shared log to record the day's danger rating, freezing level, wind and notes.
- **Forfeits** — après only. Draw a random forfeit (mild/medium/savage), defaults to whoever's currently down the most on the ledger, logs the history.

## How the data syncs (read this)

The app is still a static site with no backend of its own, but it syncs live through a small Firestore database (`sync.js`) whenever there's signal: check a box, log an expense, draw a forfeit — it appears on everyone's phone within a second or two. Firestore also caches the trip data locally and queues writes made while offline, so it keeps working through patchy backcountry signal and catches up automatically once you're back in range.

If `sync.js` can't load at all (zero signal on a first-ever page load, before anything's cached), the app still works exactly as a plain offline tool: everything saves to `localStorage`, and the **Share trip data** button on the Overview tab copies a link encoding your current data that you can send in the group chat as a manual fallback.

**Security note:** the Firestore rules restrict access to exactly one document — nothing else in the database is reachable — and that document's ID is a random unguessable string rather than anything the URL or page reveals, so knowing it is effectively the "passcode." There's no real authentication behind it, which is the right amount of effort for four friends' packing list and bar tab, not something handling anything sensitive.

## Conditions data

The app deliberately does **not** try to embed live weather/avalanche data — that would need a paid API and this is a static site. Instead the Conditions tab links straight to the real sources:

- [NZ Avalanche Advisory](https://www.avalanche.net.nz) — Craigieburn/Canterbury danger rating
- [MetService Mountain Forecast](https://www.metservice.com/mountain)
- [Mountain Safety Council](https://www.mountainsafety.org.nz)
- [NZTA Journey Planner](https://journeys.nzta.govt.nz) — SH73 Arthur's Pass road conditions

Check those before you go, then log what you find so everyone's working off the same read for the day. In an emergency, call **111**.

## Running it locally

No dependencies. Just serve the folder:

```
python3 -m http.server 8080
```

then open `http://localhost:8080`.

## Publishing on GitHub Pages

1. Push to `main`.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save — the site goes live at `https://<your-username>.github.io/<repo-name>/` within a minute or so.
