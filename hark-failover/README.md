# Hark storefront preview (failover)

Phone-openable HTTPS clone of the public Hark Coffee storefront.

**Open on a phone:** https://theoagenticsadvisoryai.github.io/portfolio-board/hark-failover/

This is a **PREVIEW**. It is not the live shop. It is not on harkcoffee.com.au. DNS was not changed.

## What this is

- Public scrape of https://harkcoffee.com.au only (same constraint as the Origin failover clone).
- Theme CSS/JS/fonts/images are hotlinked from the live Shopify CDN / shop assets. Nothing like a 100MB asset tree is vendored here.
- Browse stays on GitHub Pages under `/hark-failover/`.
- Cart, checkout, and account are a named gap: they open `hark-coffee.myshopify.com` permalinks (that host redirects to the live shop).
- For Dad roast is still 404 on the live shop. It is not invented here.

## What this is not

- Not payments on this preview.
- Not email capture (newsletter forms are disabled).
- Not Shopify admin.
- Not a custom domain and not a DNS change.

## Refresh the scrape

From this folder:

```bash
python3 build.py
```

Requires network access to https://harkcoffee.com.au. Re-run writes HTML/JSON only; it does not download the CDN asset tree.
