#!/usr/bin/env python3
"""Public scrape of harkcoffee.com.au into this folder. Hotlinks CDN assets."""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

LIVE = "https://harkcoffee.com.au"
BASE = "/portfolio-board/hark-failover"
LIVE_CART = "https://hark-coffee.myshopify.com"
UA = "Mozilla/5.0 (compatible; HarkFailoverPreview/1.0)"
ROOT = Path(__file__).resolve().parent

STORE_PREFIXES = (
    "/products",
    "/collections",
    "/pages",
    "/blogs",
    "/policies",
    "/search",
)
CART_PREFIXES = (
    "/cart",
    "/checkout",
    "/checkouts",
    "/account",
    "/challenge",
    "/discount",
)
KEEP_PATH_PREFIXES = ("/cdn/", "/cdn/shop/", "/cdn/shopifycloud/")

ANALYTICS_RE = re.compile(
    r"<script[^>]*(?:googletagmanager|gtag\(|GoogleAnalyticsObject|facebook\.net|"
    r"connect\.facebook|shopify-digital-wallet|monorail-edge|shopify-perf-kit|"
    r"shopify_pay|portable-wallets|loader\.init-shop-cart-sync)[^>]*>.*?</script>"
    r"|<noscript>\s*<iframe[^>]+googletagmanager[^>]*>.*?</noscript>"
    r"|<script[^>]+src=['\"][^'\"]*(?:googletagmanager|gtag/js|fbevents)[^'\"]*['\"][^>]*>\s*</script>",
    re.I | re.S,
)


def fetch(url: str) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, resp.read(), resp.headers.get_content_type() or ""
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", ""


def load_json(url: str):
    code, body, _ = fetch(url)
    if code != 200:
        raise RuntimeError(f"{url} -> {code}")
    return json.loads(body.decode("utf-8"))


def is_live_host(netloc: str) -> bool:
    host = (netloc or "").split(":")[0].lower()
    return host in {"", "harkcoffee.com.au", "www.harkcoffee.com.au"}


def needs_slash(path: str) -> bool:
    if path == "/" or path.endswith("/"):
        return False
    last = path.rsplit("/", 1)[-1]
    return "." not in last


def rewrite_path(path: str, query: str = "", fragment: str = "") -> str | None:
    if not path:
        path = "/"
    if not path.startswith("/"):
        return None
    if path.startswith(KEEP_PATH_PREFIXES) or path.startswith("/cdn"):
        return None
    if path.startswith(CART_PREFIXES):
        return LIVE_CART + path + query + fragment
    store = path == "/" or any(path == p or path.startswith(p + "/") for p in STORE_PREFIXES)
    if store:
        out = "/" if path == "/" else path
        if needs_slash(out):
            out += "/"
        if out == "/":
            return BASE + "/" + query + fragment
        return BASE + out + query + fragment
    return None


def rewrite_url(value: str) -> str:
    if not value or value.startswith(("mailto:", "tel:", "data:", "javascript:", "#")):
        return value
    if value.startswith("//"):
        parsed = urlparse("https:" + value)
    else:
        parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} or value.startswith("//"):
        if not is_live_host(parsed.netloc):
            return value
        if parsed.path.startswith(KEEP_PATH_PREFIXES) or parsed.path.startswith("/cdn"):
            # keep hotlink, prefer protocol-relative or https live CDN
            return value
        rewritten = rewrite_path(parsed.path, ("?" + parsed.query) if parsed.query else "", ("#" + parsed.fragment) if parsed.fragment else "")
        return rewritten if rewritten is not None else value
    if value.startswith("/"):
        q = ""
        frag = ""
        path = value
        if "#" in path:
            path, frag = path.split("#", 1)
            frag = "#" + frag
        if "?" in path:
            path, q = path.split("?", 1)
            q = "?" + q
        rewritten = rewrite_path(path, q, frag)
        return rewritten if rewritten is not None else value
    return value


ATTR_RE = re.compile(
    r"""(?P<pre>\s(?:href|src|action|content|data-src|data-href|url)=)(?P<q>['"])(?P<url>[^'"]+)(?P=q)""",
    re.I,
)
CSS_URL_RE = re.compile(r"""url\((['"]?)(/[^)'"]+)\1\)""", re.I)
CANONICAL_RE = re.compile(r"""<link\s+rel=['"]canonical['"][^>]*>""", re.I)
ROBOTS_RE = re.compile(r"""<meta\s+name=['"]robots['"][^>]*>""", re.I)


def rewrite_html(html: str, page_path: str) -> str:
    def attr_sub(m):
        url = m.group("url")
        # og:url / canonical-like absolute live URLs
        return f"{m.group('pre')}{m.group('q')}{rewrite_url(url)}{m.group('q')}"

    html = ATTR_RE.sub(attr_sub, html)
    html = CSS_URL_RE.sub(lambda m: f"url({m.group(1)}{rewrite_url(m.group(2))}{m.group(1)})", html)

    html = re.sub(
        r"window\.shopUrl\s*=\s*'https://harkcoffee\.com\.au'",
        f"window.shopUrl = 'https://theoagenticsadvisoryai.github.io{BASE}'",
        html,
    )
    html = html.replace("Shopify.routes.root = \"/\"", f'Shopify.routes.root = "{BASE}/"')
    html = html.replace("Shopify.routes.root = '/'", f"Shopify.routes.root = '{BASE}/'")

    html = re.sub(
        r"cart_add_url:\s*'/cart/add'",
        f"cart_add_url: '{LIVE_CART}/cart/add'",
        html,
    )
    html = re.sub(r"cart_change_url:\s*'/cart/change'", f"cart_change_url: '{LIVE_CART}/cart/change'", html)
    html = re.sub(r"cart_update_url:\s*'/cart/update'", f"cart_update_url: '{LIVE_CART}/cart/update'", html)
    html = re.sub(r"cart_url:\s*'/cart'", f"cart_url: '{LIVE_CART}/cart'", html)

    html = ANALYTICS_RE.sub("", html)

    banner = (
        f"<link rel='stylesheet' href='{BASE}/preview.css'>"
        f"<script src='{BASE}/preview.js' defer></script>"
        "<meta name='robots' content='noindex,nofollow'>"
    )
    if ROBOTS_RE.search(html):
        html = ROBOTS_RE.sub("<meta name='robots' content='noindex,nofollow'>", html, count=1)
        html = html.replace("<head>", "<head>\n    " + banner.replace("<meta name='robots' content='noindex,nofollow'>", ""), 1)
    else:
        html = html.replace("<head>", "<head>\n    " + banner, 1)

    html = CANONICAL_RE.sub(
        f"<link rel='canonical' href='https://theoagenticsadvisoryai.github.io{BASE}{page_path}'>",
        html,
        count=1,
    )

    banner = (
        "<div id='hark-failover-banner' role='status'>"
        "<span><strong>PREVIEW</strong> — not the live Hark store. "
        "Browse only on GitHub Pages. Cart/checkout opens the live shop.</span>"
        f"<span><a href='{BASE}/'>Preview home</a> · "
        "<a href='/portfolio-board/'>Back to board</a></span>"
        "</div>"
    )

    def body_sub(m):
        attrs = m.group(1) or ""
        if "hark-failover-preview" not in attrs:
            if re.search(r"class=['\"]", attrs, re.I):
                attrs = re.sub(r"class=(['\"])", r"class=\1hark-failover-preview ", attrs, count=1, flags=re.I)
            else:
                attrs += " class='hark-failover-preview'"
        return f"<body{attrs}>{banner}"

    html = re.sub(r"<body([^>]*)>", body_sub, html, count=1, flags=re.I)
    return html


def dest_for(path: str) -> Path:
    path = path.split("?")[0].rstrip("/") or "/"
    if path == "/":
        return ROOT / "index.html"
    rel = path.lstrip("/")
    if rel.endswith(".js") or rel.endswith(".json"):
        return ROOT / rel
    return ROOT / rel / "index.html"


def save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def save_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def scrape_html(path: str) -> bool:
    url = urljoin(LIVE + "/", path.lstrip("/"))
    if path == "/":
        url = LIVE + "/"
    code, body, ctype = fetch(url)
    if code != 200:
        print(f"  skip {path} -> {code}")
        return False
    text = body.decode("utf-8", errors="replace")
    page_path = "/" if path == "/" else (path if path.endswith("/") or "." in path.rsplit("/", 1)[-1] else path + "/")
    if not page_path.startswith("/"):
        page_path = "/" + page_path
    if page_path != "/" and needs_slash(page_path):
        page_path += "/"
    out = rewrite_html(text, page_path if page_path != "/" else "/")
    save_text(dest_for(path), out)
    print(f"  html {path} ({len(body)} bytes)")
    return True


def scrape_raw(path: str) -> bool:
    url = urljoin(LIVE + "/", path.lstrip("/"))
    code, body, _ = fetch(url)
    if code != 200:
        print(f"  skip {path} -> {code}")
        return False
    save_bytes(dest_for(path), body)
    print(f"  raw  {path} ({len(body)} bytes)")
    return True


EMPTY_CART = {
    "token": "hark-failover-preview",
    "note": None,
    "attributes": {"preview": "true"},
    "original_total_price": 0,
    "total_price": 0,
    "total_discount": 0,
    "total_weight": 0.0,
    "item_count": 0,
    "items": [],
    "requires_shipping": False,
    "currency": "AUD",
    "items_subtotal_price": 0,
    "cart_level_discount_applications": [],
}


def write_cart_page() -> None:
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>PREVIEW cart — Hark Coffee</title>
  <link rel="stylesheet" href="{BASE}/preview.css">
</head>
<body class="hark-failover-preview">
  <div id="hark-failover-banner" role="status">
    <span><strong>PREVIEW</strong> — cart is a named gap. This preview does not take payment.</span>
    <span><a href="{BASE}/">Preview home</a> · <a href="/portfolio-board/">Back to board</a></span>
  </div>
  <main style="font:16px/1.45 -apple-system,system-ui,sans-serif;padding:28px 18px;max-width:40rem">
    <h1>Cart opens the live shop</h1>
    <p>This GitHub Pages preview cannot hold a Shopify cart. Checkout stays on the live store via hark-coffee.myshopify.com permalinks.</p>
    <p><a href="{LIVE_CART}/cart">Open live cart</a></p>
  </main>
</body>
</html>
"""
    save_text(ROOT / "cart" / "index.html", html)
    save_text(ROOT / "cart.js", json.dumps(EMPTY_CART))


def discover() -> list[str]:
    products = load_json(f"{LIVE}/products.json?limit=250")["products"]
    collections = load_json(f"{LIVE}/collections.json?limit=250")["collections"]
    pages = load_json(f"{LIVE}/pages.json?limit=250")["pages"]
    save_text(ROOT / "products.json", json.dumps({"products": products}, indent=2))
    save_text(ROOT / "collections.json", json.dumps({"collections": collections}, indent=2))
    save_text(ROOT / "pages.json", json.dumps({"pages": pages}, indent=2))

    handles_products = [p["handle"] for p in products]
    handles_collections = [c["handle"] for c in collections]
    handles_pages = [p["handle"] for p in pages]

    # refuse to invent For Dad
    banned = {"for-dad", "for-dad-roast", "dad-roast", "dads-roast"}
    for h in handles_products:
        if h in banned:
            raise SystemExit(f"refusing banned handle {h}")

    print("products:", ", ".join(handles_products))
    html_paths = ["/"]
    html_paths.append("/collections")
    html_paths.append("/search")
    html_paths.append("/blogs/journal")
    html_paths.extend(f"/products/{h}" for h in handles_products)
    html_paths.extend(f"/collections/{h}" for h in handles_collections)
    html_paths.extend(f"/pages/{h}" for h in handles_pages)
    html_paths.extend(
        [
            "/policies/privacy-policy",
            "/policies/refund-policy",
            "/policies/terms-of-service",
        ]
    )
    blog_paths = [
        "/blogs/journal/climate-shocks-and-your-morning-coffee-how-global-weather-affects-australia-s-supply",
        "/blogs/journal/air-roasted-coffee",
        "/blogs/journal/why-your-morning-coffee-costs-more-than-you-think",
    ]
    # discover blogs from sitemap
    code, body, _ = fetch(f"{LIVE}/sitemap_blogs_1.xml")
    if code == 200:
        found = re.findall(r"<loc>(https://harkcoffee\.com\.au/blogs/[^<]+)</loc>", body.decode())
        for loc in found:
            p = urlparse(loc).path
            if p not in html_paths:
                blog_paths.append(p)
    html_paths.extend(blog_paths)

    raw_paths = ["products.json", "collections.json"]
    raw_paths.extend(f"products/{h}.js" for h in handles_products)
    raw_paths.extend(f"products/{h}.json" for h in handles_products)
    raw_paths.extend(f"collections/{h}.js" for h in handles_collections)
    raw_paths.extend(f"collections/{h}/products.json" for h in handles_collections)
    return html_paths, [f"/{p}" if not p.startswith("/") else p for p in raw_paths]


def main() -> None:
    html_paths, raw_paths = discover()
    seen = set()
    for path in html_paths:
        if path in seen:
            continue
        seen.add(path)
        scrape_html(path)
        time.sleep(0.05)
    for path in raw_paths:
        if path in {"/products.json", "/collections.json"}:
            continue
        scrape_raw(path)
        time.sleep(0.03)
    write_cart_page()
    print("done", ROOT)


if __name__ == "__main__":
    main()
