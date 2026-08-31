(function () {
  var BASE = "/portfolio-board/hark-failover";
  var LIVE_CART = "https://hark-coffee.myshopify.com";

  function withBase(path) {
    if (!path) return BASE + "/";
    if (path.charAt(0) !== "/") path = "/" + path;
    return BASE + path;
  }

  function isCartPath(path) {
    return /^\/(cart|checkout|checkouts|account|challenge|discount)(\/|\?|$)/.test(path);
  }

  function rewriteStorePath(path) {
    var raw = path || "/";
    var q = "";
    var hash = "";
    var i = raw.indexOf("#");
    if (i !== -1) {
      hash = raw.slice(i);
      raw = raw.slice(0, i);
    }
    i = raw.indexOf("?");
    if (i !== -1) {
      q = raw.slice(i);
      raw = raw.slice(0, i);
    }
    if (isCartPath(raw)) return LIVE_CART + raw + q + hash;
    if (
      raw === "/" ||
      /^\/(products|collections|pages|blogs|policies|search)(\/|$)/.test(raw)
    ) {
      if (raw !== "/" && !/\.[a-z0-9]+$/i.test(raw) && raw.slice(-1) !== "/") raw += "/";
      return withBase(raw) + q + hash;
    }
    return null;
  }

  if (window.Shopify) {
    window.Shopify.routes = window.Shopify.routes || {};
    window.Shopify.routes.root = BASE + "/";
  }
  window.shopUrl = "https://theoagenticsadvisoryai.github.io" + BASE;
  if (window.routes) {
    window.routes.cart_add_url = LIVE_CART + "/cart/add";
    window.routes.cart_change_url = LIVE_CART + "/cart/change";
    window.routes.cart_update_url = LIVE_CART + "/cart/update";
    window.routes.cart_url = LIVE_CART + "/cart";
  }

  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;
      var url;
      try {
        url = new URL(href, window.location.origin);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin && url.hostname !== "harkcoffee.com.au" && url.hostname !== "www.harkcoffee.com.au") return;
      if (url.pathname.indexOf("/cdn/") === 0) return;
      var next = rewriteStorePath(url.pathname + url.search + url.hash);
      if (!next) return;
      e.preventDefault();
      if (a.target === "_blank") window.open(next, "_blank", "noopener");
      else window.location.href = next;
    },
    true
  );

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      if (form.closest("klaviyo-form") || form.querySelector("[name=email],[type=email]")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      var action = form.getAttribute("action") || "";
      var path = action;
      try {
        if (action) path = new URL(action, window.location.origin).pathname;
      } catch (err) {}
      if (isCartPath(path) || /cart\/add/.test(action)) {
        e.preventDefault();
        var id = form.querySelector("[name=id]");
        var qty = form.querySelector("[name=quantity]");
        var variant = id && id.value;
        var quantity = (qty && qty.value) || "1";
        if (variant) {
          window.location.href = LIVE_CART + "/cart/" + encodeURIComponent(variant) + ":" + encodeURIComponent(quantity);
        } else {
          window.location.href = LIVE_CART + "/cart";
        }
      }
    },
    true
  );

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      if (url) {
        try {
          var parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin && isCartPath(parsed.pathname)) {
            var id = null;
            var qty = "1";
            if (init && init.body && typeof init.body === "string") {
              try {
                var body = JSON.parse(init.body);
                id = body.id || (body.items && body.items[0] && body.items[0].id);
                qty = body.quantity || (body.items && body.items[0] && body.items[0].quantity) || "1";
              } catch (err) {
                var params = new URLSearchParams(init.body);
                id = params.get("id");
                qty = params.get("quantity") || "1";
              }
            }
            if (id && /\/cart\/add/.test(parsed.pathname)) {
              window.location.href = LIVE_CART + "/cart/" + encodeURIComponent(id) + ":" + encodeURIComponent(qty);
              return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
            }
            window.location.href = LIVE_CART + parsed.pathname + parsed.search;
            return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
          }
          if (parsed.origin === window.location.origin && parsed.pathname.indexOf(BASE) !== 0) {
            if (/^\/(products|collections|pages|blogs|policies|search)(\/|\.|$)/.test(parsed.pathname)) {
              var rewritten = withBase(parsed.pathname) + parsed.search;
              if (typeof input === "string") input = rewritten;
              else if (input && typeof Request !== "undefined") input = new Request(rewritten, input);
            }
          }
        } catch (err) {}
      }
      return origFetch.call(this, input, init);
    };
  }
})();
