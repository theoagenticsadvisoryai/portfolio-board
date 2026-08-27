(function () {
  "use strict";

  var KEY = {
    orders: "tl_orders_v1",
    eighty: "tl_86_v1",
    customers: "tl_customers_v1",
    nextId: "tl_next_id_v1",
    seeded: "tl_seeded_v1"
  };

  var MENU = [
    { id: "birria", label: "Birria", pass: "BIRRIA", price: 8, kind: "taco" },
    { id: "fish", label: "Fish", pass: "FISH", price: 8, kind: "taco" },
    { id: "chicken", label: "Chicken chipotle", pass: "CHICKEN", price: 8, kind: "taco" },
    { id: "quesadilla", label: "Mushroom quesadilla", pass: "QUESADILLA", price: 16, kind: "quesadilla" },
    { id: "elotes", label: "Corn ribs", pass: "ELOTES", sub: "Elotes", price: 12, kind: "side" },
    { id: "churros", label: "Nutella churros", pass: "CHURROS", sub: "Serve of 8 minis", price: 12, kind: "sweet" }
  ];

  var cart = {
    mode: "takeaway",
    step: "menu",
    units: [],
    name: "",
    phone: "",
    err: "",
    lastId: null
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function route() {
    var h = (location.hash || "#/").replace(/^#/, "");
    if (!h) h = "/";
    h = h.split("?")[0];
    if (h.charAt(0) !== "/") h = "/" + h;
    if (h.length > 1 && h.slice(-1) === "/") h = h.slice(0, -1);
    return h;
  }

  function go(path) {
    if (location.hash !== "#" + path) location.hash = path;
    else render();
  }

  function readySms(order) {
    if (order.mode === "dine-in") {
      return "TACO LIBRE #" + order.id + ": your food is up.";
    }
    return "TACO LIBRE #" + order.id + ": takeaway is up. Window.";
  }

  function seed() {
    if (load(KEY.seeded, false)) return;
    var orders = [
      {
        id: 41,
        mode: "takeaway",
        name: "Rosa V",
        phone: "0412 555 010",
        status: "open",
        createdAt: Date.now() - 12 * 60 * 1000,
        units: [
          { sku: "birria", noSalsa: false, heat: "hot", noCheese: true, noCoriander: false },
          { sku: "birria", noSalsa: false, heat: "hot", noCheese: true, noCoriander: false }
        ]
      },
      {
        id: 42,
        mode: "dine-in",
        name: "Tom Keane",
        phone: "0433 555 019",
        status: "open",
        createdAt: Date.now() - 6 * 60 * 1000,
        units: [
          { sku: "fish", noSalsa: false, heat: "medium", noCheese: false, noCoriander: true }
        ]
      }
    ];
    save(KEY.orders, orders);
    save(KEY.customers, [
      { name: "Rosa V", phone: "0412555010", orderIds: [41] },
      { name: "Tom Keane", phone: "0433555019", orderIds: [42] }
    ]);
    save(KEY.eighty, { birria: false, fish: false, chicken: false, quesadilla: false, elotes: false, churros: false });
    save(KEY.nextId, 43);
    save(KEY.seeded, true);
  }

  function orders() { return load(KEY.orders, []); }
  function setOrders(list) { save(KEY.orders, list); }
  function eighty() {
    var e = load(KEY.eighty, {});
    MENU.forEach(function (m) { if (e[m.id] == null) e[m.id] = false; });
    return e;
  }
  function customers() { return load(KEY.customers, []); }

  function digits(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function upsertCustomer(name, phone, orderId) {
    var d = digits(phone);
    var list = customers();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (digits(list[i].phone) === d) { found = list[i]; break; }
    }
    if (found) {
      if (name && !found.name) found.name = name;
      if (found.orderIds.indexOf(orderId) === -1) found.orderIds.push(orderId);
    } else {
      list.push({ name: name || "", phone: d, orderIds: [orderId] });
    }
    save(KEY.customers, list);
  }

  function skuMeta(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return { id: id, label: id, pass: id.toUpperCase() };
  }

  function countSku(sku) {
    var n = 0;
    for (var i = 0; i < cart.units.length; i++) if (cart.units[i].sku === sku) n++;
    return n;
  }

  function money(n) {
    return "$" + Number(n || 0).toFixed(0);
  }

  function addUnit(sku) {
    cart.units.push({
      uid: "u" + Date.now() + Math.random().toString(16).slice(2),
      sku: sku,
      noSalsa: false,
      noCheese: false,
      noCoriander: false,
      noMushroom: false,
      heat: "medium"
    });
  }

  function removeUnit(sku) {
    for (var i = cart.units.length - 1; i >= 0; i--) {
      if (cart.units[i].sku === sku) {
        cart.units.splice(i, 1);
        return;
      }
    }
  }

  function resetCart(mode) {
    cart.mode = mode;
    cart.step = "menu";
    cart.units = [];
    cart.name = "";
    cart.phone = "";
    cart.err = "";
    cart.lastId = null;
  }

  function windowArt() {
    return (
      '<div class="window-wrap" aria-hidden="true">' +
        '<svg viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<radialGradient id="glow" cx="50%" cy="40%" r="70%">' +
              '<stop offset="0%" stop-color="#f3d48a"/>' +
              '<stop offset="55%" stop-color="#c45c2a"/>' +
              '<stop offset="100%" stop-color="#6a1c14"/>' +
            '</radialGradient>' +
          '</defs>' +
          '<rect width="320" height="210" fill="#071018"/>' +
          '<rect x="0" y="168" width="320" height="42" fill="#05090e"/>' +
          '<rect x="86" y="26" width="148" height="158" fill="#3a1412"/>' +
          '<rect x="94" y="34" width="132" height="142" fill="#8b221c"/>' +
          '<rect x="102" y="42" width="116" height="126" fill="url(#glow)"/>' +
          '<rect x="158" y="42" width="3" height="126" fill="#8b221c" opacity="0.35"/>' +
          '<rect x="102" y="102" width="116" height="3" fill="#8b221c" opacity="0.35"/>' +
          '<ellipse cx="160" cy="124" rx="50" ry="9" fill="#0a0c10"/>' +
          '<path d="M128 124 C132 90 188 90 192 124" fill="#0a0c10"/>' +
          '<rect x="141" y="112" width="38" height="34" rx="3" fill="#0a0c10"/>' +
          '<rect x="147" y="122" width="9" height="3.2" fill="#e8c36a"/>' +
          '<rect x="164" y="122" width="9" height="3.2" fill="#e8c36a"/>' +
          '<path d="M120 210 L138 148 H182 L200 210 Z" fill="#0a0c10"/>' +
        '</svg>' +
      '</div>'
    );
  }

  function footGuest() {
    return '<p class="demo-foot">DEMO — no live cards.</p>';
  }

  function viewWall() {
    return (
      '<div class="poster">' +
        windowArt() +
        '<div class="doors">' +
          '<a class="door take" href="#/takeaway">' +
            '<span class="big">TAKEAWAY</span>' +
            '<span class="kicker">Scan. We\'ll text you.</span>' +
          '</a>' +
          '<a class="door dine" href="#/dine-in">' +
            '<span class="big">DINE IN</span>' +
            '<span class="kicker">Scan. Stay.</span>' +
          '</a>' +
        '</div>' +
        '<div class="staff-links">' +
          '<a href="#/pass">Pass</a>' +
          '<a href="#/admin">Admin</a>' +
        '</div>' +
        footGuest() +
      '</div>'
    );
  }

  function introBlock() {
    var dine = cart.mode === "dine-in";
    var modeWord = dine ? "Dine in" : "Takeaway";
    var line = dine ? "Two tacos. You stay." : "Two tacos. Out the window.";
    return (
      '<div class="intro ' + (dine ? "dine" : "take") + '">' +
        '<p class="brand">TACO LIBRE</p>' +
        '<p class="mode">' + modeWord + '</p>' +
        '<p class="line">' + line + '</p>' +
      '</div>'
    );
  }

  function viewMenu() {
    var six = eighty();
    var cards = MENU.map(function (m) {
      var n = countSku(m.id);
      var gone = !!six[m.id];
      return (
        '<div class="item' + (gone ? " gone" : "") + '">' +
          '<div><h2>' + esc(m.label) + '</h2>' +
            (m.sub ? '<p class="subline">' + esc(m.sub) + '</p>' : '') +
            '<p class="price">' + money(m.price) + '</p></div>' +
          (gone
            ? '<div class="stamp-86">86</div>'
            : '<div class="stepper">' +
                '<button type="button" data-act="minus" data-sku="' + m.id + '" ' + (n === 0 ? "disabled" : "") + '>−</button>' +
                '<span class="qty">' + n + '</span>' +
                '<button type="button" data-act="plus" data-sku="' + m.id + '">+</button>' +
              '</div>') +
        '</div>'
      );
    }).join("");
    return (
      introBlock() +
      '<h1 class="screen-title">What\'s through the window.</h1>' +
      cards +
      '<div class="sticky-cta">' +
        '<button class="btn" type="button" data-act="to-mods" ' + (cart.units.length ? "" : "disabled") + '>Next</button>' +
      '</div>' +
      footGuest()
    );
  }

  function tickBtn(on, act, uid, label) {
    return (
      '<button type="button" class="tick' + (on ? " on" : "") + '" data-act="' + act + '" data-uid="' + uid + '">' +
        '<span class="box">' + (on ? "×" : "") + '</span>' +
        label +
      '</button>'
    );
  }

  function viewMods() {
    var cards = cart.units.map(function (u, i) {
      var meta = skuMeta(u.sku);
      var ticks = "";
      var heat = "";
      if (meta.kind === "taco") {
        if (!u.noSalsa) {
          heat =
            '<div class="heat">' +
              '<button type="button" class="hot' + (u.heat === "hot" ? " on" : "") + '" data-act="heat" data-uid="' + u.uid + '" data-heat="hot">Hot</button>' +
              '<button type="button" class="med' + (u.heat === "medium" ? " on" : "") + '" data-act="heat" data-uid="' + u.uid + '" data-heat="medium">Medium</button>' +
            '</div>';
        }
        ticks =
          '<div class="ticks">' +
            tickBtn(u.noSalsa, "tick-salsa", u.uid, "No salsa") +
            tickBtn(u.noCheese, "tick-cheese", u.uid, "No cheese") +
            tickBtn(u.noCoriander, "tick-coriander", u.uid, "No coriander") +
          "</div>";
      } else if (meta.kind === "quesadilla") {
        ticks =
          '<div class="ticks">' +
            tickBtn(u.noMushroom, "tick-mushroom", u.uid, "No mushroom") +
          "</div>";
      }
      return (
        '<div class="mod-card">' +
          '<div class="who">' + esc(meta.pass) + " · " + (i + 1) + " · " + money(meta.price) + "</div>" +
          ticks +
          heat +
        "</div>"
      );
    }).join("");
    return (
      introBlock() +
      '<h1 class="screen-title">Leave it off.</h1>' +
      cards +
      '<div class="sticky-cta">' +
        '<button class="btn" type="button" data-act="to-pay">Next</button>' +
        '<button class="btn ghost" type="button" data-act="to-menu">Back</button>' +
      "</div>" +
      footGuest()
    );
  }

  function unitTicks(u) {
    var t = [];
    var kind = skuMeta(u.sku).kind;
    if (kind === "quesadilla") {
      if (u.noMushroom) t.push("No mushroom");
    } else if (kind === "taco") {
      if (u.noSalsa) t.push("No salsa");
      else t.push(u.heat === "hot" ? "Hot" : "Medium");
      if (u.noCheese) t.push("No cheese");
      if (u.noCoriander) t.push("No coriander");
    }
    return t;
  }

  function groupUnits(units) {
    var groups = [];
    var map = {};
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var key = [u.sku, u.noSalsa, u.heat || "", u.noCheese, u.noCoriander].join("|");
      if (!map[key]) {
        map[key] = { sku: u.sku, qty: 0, ticks: unitTicks(u) };
        groups.push(map[key]);
      }
      map[key].qty += 1;
    }
    return groups;
  }

  function viewPay() {
    var groups = groupUnits(cart.units);
    var lines = groups.map(function (g) {
      var ticks = g.ticks.length
        ? '<span class="mods">' + esc(g.ticks.join(" · ")) + "</span>"
        : "";
      return "<li><span>" + esc(skuMeta(g.sku).pass) + " ×" + g.qty + ticks + "</span><span>" + money((skuMeta(g.sku).price || 0) * g.qty) + "</span></li>";
    }).join("");
    return (
      introBlock() +
      '<div class="phone-copy">' +
        '<p class="lead">Your number.</p>' +
        '<p class="sub">We text when it\'s up.</p>' +
      "</div>" +
      '<label class="field">Your name.' +
        '<input id="f-name" type="text" autocomplete="name" value="' + esc(cart.name) + '">' +
      "</label>" +
      '<label class="field">Your number.' +
        '<input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(cart.phone) + '">' +
      "</label>" +
      '<p class="err" id="f-err">' + esc(cart.err) + "</p>" +
      '<ul class="summary">' + lines + "</ul>" +
      '<p class="total-line">Total ' + money(cart.units.reduce(function (s, u) { return s + (skuMeta(u.sku).price || 0); }, 0)) + '</p>' +
      '<p class="pay-note">Demo only. No card. No charge.</p>' +
      '<div class="sticky-cta">' +
        '<button class="btn" type="button" data-act="send">Send the ticket</button>' +
        '<button class="btn ghost" type="button" data-act="to-mods">Back</button>' +
      "</div>" +
      footGuest()
    );
  }

  function viewDone() {
    return (
      '<div class="success">' +
        '<h1>It\'s in.</h1>' +
        '<p class="line">We\'ll text you.</p>' +
        (cart.lastId ? '<p class="orderno">#' + cart.lastId + "</p>" : "") +
      "</div>" +
      '<div class="sticky-cta">' +
        '<a class="btn" href="#/" style="display:grid;place-items:center;text-decoration:none">Wall</a>' +
      "</div>" +
      footGuest()
    );
  }

  function ticketLinesHtml(order) {
    return groupUnits(order.units).map(function (g) {
      var ticks = g.ticks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      return (
        '<div class="t-line">' +
          '<div class="t-sku">' + esc(skuMeta(g.sku).pass) + " ×" + g.qty + "</div>" +
          (ticks ? '<ul class="t-ticks">' + ticks + "</ul>" : "") +
        "</div>"
      );
    }).join("");
  }

  function viewPass() {
    var list = orders().slice().sort(function (a, b) {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
    var html = '<h1 class="staff-head">Pass</h1>';
    if (!list.length) html += '<p class="empty">No tickets.</p>';
    html += list.map(function (o) {
      var dine = o.mode === "dine-in";
      var ready = o.status === "ready";
      var sms = readySms(o);
      return (
        '<article class="ticket' + (dine ? " dine" : "") + (ready ? " ready" : "") + '">' +
          '<div class="ticket-head">' + (dine ? "DINE IN" : "TAKEAWAY") + "</div>" +
          '<div class="num">#' + o.id + "</div>" +
          ticketLinesHtml(o) +
          (ready
            ? ""
            : '<button class="btn small" type="button" data-act="ready" data-id="' + o.id + '">Mark Ready</button>') +
          '<div class="sms"><span class="cap">' +
            (ready ? "Would have sent — not sent" : "Ready SMS — not sent") +
          "</span>" + esc(sms) + "</div>" +
        "</article>"
      );
    }).join("");
    html +=
      '<div class="staff-links">' +
        '<a href="#/">Wall</a>' +
        '<a href="#/admin">Admin</a>' +
      "</div>";
    return html;
  }

  function viewAdmin() {
    var six = eighty();
    var rows = MENU.map(function (m) {
      var on = !six[m.id];
      return (
        '<div class="row86">' +
          "<h2>" + esc(m.label) + "</h2>" +
          '<button type="button" class="sw ' + (on ? "on" : "off") + '" data-act="86" data-sku="' + m.id + '">' +
            (on ? "ON" : "86") +
          "</button>" +
        "</div>"
      );
    }).join("");
    var cust = customers();
    var table =
      '<table class="cust"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th></tr></thead><tbody>' +
      cust.map(function (c) {
        return (
          "<tr><td>" + esc(c.name) + "</td><td>" + esc(c.phone) + "</td><td>#" +
          esc((c.orderIds || []).join(" #")) +
          "</td></tr>"
        );
      }).join("") +
      "</tbody></table>";
    return (
      '<h1 class="staff-head">Admin</h1>' +
      '<p class="note">86 an item. The window list is yours — download it.</p>' +
      rows +
      table +
      '<button class="btn" type="button" data-act="csv">Download CSV</button>' +
      '<div class="staff-links">' +
        '<a href="#/">Wall</a>' +
        '<a href="#/pass">Pass</a>' +
      "</div>"
    );
  }

  function csvEscape(s) {
    s = String(s == null ? "" : s);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCsv() {
    var lines = ["name,phone,order_ids"];
    customers().forEach(function (c) {
      lines.push(
        [csvEscape(c.name), csvEscape(c.phone), csvEscape((c.orderIds || []).join("|"))].join(",")
      );
    });
    var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "taco-libre-customers.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }

  function placeOrder() {
    cart.name = ($("#f-name") && $("#f-name").value || "").trim();
    cart.phone = ($("#f-phone") && $("#f-phone").value || "").trim();
    cart.err = "";
    if (!cart.name) {
      cart.err = "Name.";
      render();
      return;
    }
    if (digits(cart.phone).length < 8) {
      cart.err = "Number.";
      render();
      return;
    }
    var id = load(KEY.nextId, 43);
    save(KEY.nextId, id + 1);
    var order = {
      id: id,
      mode: cart.mode,
      name: cart.name,
      phone: cart.phone,
      status: "open",
      createdAt: Date.now(),
      units: cart.units.map(function (u) {
        return {
          sku: u.sku,
          noSalsa: !!u.noSalsa,
          heat: u.noSalsa ? "" : (u.heat || "medium"),
          noCheese: !!u.noCheese,
          noCoriander: !!u.noCoriander
        };
      })
    };
    var list = orders();
    list.push(order);
    setOrders(list);
    upsertCustomer(cart.name, cart.phone, id);
    cart.lastId = id;
    cart.step = "done";
    render();
  }

  function findUnit(uid) {
    for (var i = 0; i < cart.units.length; i++) {
      if (cart.units[i].uid === uid) return cart.units[i];
    }
    return null;
  }

  function onClick(e) {
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    var sku = t.getAttribute("data-sku");
    var uid = t.getAttribute("data-uid");
    var six = eighty();

    if (act === "plus") {
      if (six[sku]) return;
      addUnit(sku);
      render();
      return;
    }
    if (act === "minus") {
      removeUnit(sku);
      render();
      return;
    }
    if (act === "to-mods") {
      if (!cart.units.length) return;
      cart.step = "mods";
      render();
      return;
    }
    if (act === "to-menu") {
      cart.step = "menu";
      render();
      return;
    }
    if (act === "to-pay") {
      cart.step = "pay";
      cart.err = "";
      render();
      return;
    }
    if (act === "tick-mushroom") {
      u = findUnit(uid);
      if (!u) return;
      u.noMushroom = !u.noMushroom;
      render();
      return;
    }
    if (act === "tick-salsa") {
      var u = findUnit(uid);
      if (!u) return;
      u.noSalsa = !u.noSalsa;
      if (!u.noSalsa && !u.heat) u.heat = "medium";
      render();
      return;
    }
    if (act === "tick-cheese") {
      u = findUnit(uid);
      if (!u) return;
      u.noCheese = !u.noCheese;
      render();
      return;
    }
    if (act === "tick-coriander") {
      u = findUnit(uid);
      if (!u) return;
      u.noCoriander = !u.noCoriander;
      render();
      return;
    }
    if (act === "heat") {
      u = findUnit(uid);
      if (!u) return;
      u.heat = t.getAttribute("data-heat");
      render();
      return;
    }
    if (act === "send") {
      placeOrder();
      return;
    }
    if (act === "ready") {
      var id = parseInt(t.getAttribute("data-id"), 10);
      var list = orders();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) list[i].status = "ready";
      }
      setOrders(list);
      render();
      return;
    }
    if (act === "86") {
      six[sku] = !six[sku];
      save(KEY.eighty, six);
      if (six[sku]) {
        cart.units = cart.units.filter(function (x) { return x.sku !== sku; });
      }
      render();
      return;
    }
    if (act === "csv") {
      downloadCsv();
    }
  }

  function onInput(e) {
    if (e.target.id === "f-name") cart.name = e.target.value;
    if (e.target.id === "f-phone") cart.phone = e.target.value;
  }

  var lastOrderRoute = "";

  function render() {
    seed();
    var r = route();
    var app = document.getElementById("app");
    var title = "Taco Libre";

    if (r === "/takeaway" || r === "/dine-in") {
      var mode = r === "/dine-in" ? "dine-in" : "takeaway";
      if (lastOrderRoute !== r) {
        resetCart(mode);
        lastOrderRoute = r;
      }
      cart.mode = mode;
      if (cart.step === "mods" && !cart.units.length) cart.step = "menu";
      if (cart.step === "menu") app.innerHTML = viewMenu();
      else if (cart.step === "mods") app.innerHTML = viewMods();
      else if (cart.step === "pay") app.innerHTML = viewPay();
      else app.innerHTML = viewDone();
      title = mode === "dine-in" ? "Taco Libre — Dine in" : "Taco Libre — Takeaway";
    } else if (r === "/pass") {
      lastOrderRoute = "";
      app.innerHTML = viewPass();
      title = "Taco Libre — Pass";
    } else if (r === "/admin") {
      lastOrderRoute = "";
      app.innerHTML = viewAdmin();
      title = "Taco Libre — Admin";
    } else {
      lastOrderRoute = "";
      app.innerHTML = viewWall();
    }
    document.title = title;
  }

  document.getElementById("app").addEventListener("click", onClick);
  document.getElementById("app").addEventListener("input", onInput);
  window.addEventListener("hashchange", render);
  seed();
  render();
})();
