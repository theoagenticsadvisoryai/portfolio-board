# Taco Libre QR demo

Static, mobile-first ordering demo. One folder. No build step. No Stripe. No SMS. No spend.

## How to run

From this folder:

```bash
python3 -m http.server 8000
```

Then open on a phone or desktop:

- Wall (two QR destinations): http://127.0.0.1:8000/
- Takeaway: http://127.0.0.1:8000/#/takeaway
- Dine in: http://127.0.0.1:8000/#/dine-in
- Kitchen pass: http://127.0.0.1:8000/#/pass
- Admin: http://127.0.0.1:8000/#/admin

Or open `index.html` as a file. Hash routes still work.

Files to open: **`index.html`**. CSS and JS load from `css/app.css` and `js/app.js`.

Optional: Google font (Libre Baskerville, Bebas Neue, Kalam). Everything else works offline with the system stack.

## Guest flow

1. Wall: **TAKEAWAY** / Scan. We'll text you. · **DINE IN** / Scan. Stay.
2. Mode landing + menu: TACO LIBRE / Takeaway or Dine in / Two tacos… then **What's through the window.** Birria and Fish only. Plus / minus. No prices.
3. **Leave it off.** Ticks: No salsa / No cheese / No coriander. If salsa stays on, Hot or Medium.
4. **Your number.** / We text when it's up. Name + mobile. **Demo only. No card. No charge.** Button: **Send the ticket**
5. **It's in.** / We'll text you.

Every guest screen footer: **DEMO — no live cards.**

## Staff

- **Pass** — open tickets in localStorage. Header TAKEAWAY or DINE IN, then #n, then BIRRIA ×2 / FISH ×1 with ticks under the line. **Mark Ready** shows the SMS that would have sent. Nothing is sent.
  - Takeaway: `TACO LIBRE #{n}: takeaway is up. Window.`
  - Dine in: `TACO LIBRE #{n}: your food is up.`
- **Admin** — 86 Birria or Fish (hides it on the menu). Download CSV of fake + session customers (name, phone, order ids). That list lives in this browser.

Two kitchen tickets are seeded on first load so Pass is not empty.

## What is fake

- No live payments. No Stripe keys. No card fields. No charge.
- No SMS. The ready text is preview only.
- No network spend. No vendor chrome. No Uber. No app-store wrapper.
- Customers, 86 flags, and tickets are localStorage only.

## Copy lock

Guest-facing words are the 26 Aug Taco Libre CEO set. No dollar figures on any guest screen.
