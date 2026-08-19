(() => {
  "use strict";

  const PEOPLE = ["Scribe", "Kaos", "No-Plan", "Camshaft"];
  const DANGER_LEVELS = ["Low", "Moderate", "Considerable", "High", "Extreme"];
  const STORAGE_KEY = "chdp-trip-state-v1";
  const VIP_KEY = "chdp-vip-v1"; // device-local only — never part of shared state, never leaves this phone

  const FORFEIT_POOL = {
    mild: [
      "Skol your drink, no hands.",
      "Do 10 squats in your boots before your next sip.",
      "Give your best avalanche safety briefing… to a rock.",
      "Speak only in trail-report jargon for the next round (“firm, variable, tracked out”).",
      "Finish your drink standing on one leg.",
      "Add “Dawn Patrol” to your Instagram bio for the next 24 hours.",
    ],
    medium: [
      "Down your drink, then send a voice memo of you singing to the group chat.",
      "Wear your helmet at the table until your next drink.",
      "Let the group pick your dating app bio for the next hour.",
      "Reenact your gnarliest fall of the day in slow motion, no talking.",
      "Do your drink in the voice of a 1920s radio announcer describing today's conditions.",
      "Swap a piece of clothing with the person to your left for the rest of the round.",
    ],
    savage: [
      "Down your drink, then post the worst photo of yourself from the trip to the group chat, no caption.",
      "Call a family member right now and tell them, dead serious, that you just landed a backcountry double cork.",
      "Whoever's the biggest debtor on the ledger buys the next round AND wears their base layers on the outside for the rest of the night.",
      "Do your drink, then let the group write your next Instagram caption, unedited, no vetoes.",
      "Recreate the most dramatic moment of today's tour as interpretive dance.",
      "Down it, then confess your most embarrassing yard-sale of all time, in full detail.",
      "Everyone else picks one word — you have to work all of them into a toast, right now, no prep.",
    ],
  };

  const CHECKLIST = [
    { cat: "Avalanche safety", items: [
      "Transceiver — digital, 3-antenna, battery >65% (no dual-antenna Ortovox / BCA Tracker 1)",
      "Shovel — metal, not plastic",
      "Probe — less than 10 years old",
    ]},
    { cat: "Touring gear", items: [
      "Splitboard + skins that fit",
      "Ski/splitboard crampons — for firm snow",
      "Boots — comfortable for walking, fit your bindings",
    ]},
    { cat: "Clothing", items: [
      "Waterproof shell jacket",
      "Waterproof shell pants",
      "2–3 mid-layers / thermals (no cotton)",
      "Long john thermals",
      "Spare warm jacket — down or synthetic puffy",
      "Neck gaiter / buff",
      "Warm hat / beanie",
      "Sun hat",
      "2–3 pairs of gloves — better than mittens",
      "Goggles",
      "Sunglasses",
      "Helmet (recommended)",
    ]},
    { cat: "Essentials", items: [
      "Headlamp",
      "Lunch, snacks, water",
      "Thermos (recommended)",
      "Sunscreen / lip screen",
      "Personal blister kit",
      "Medications, if needed",
    ]},
    { cat: "Pack", items: [
      "Pack, 30–45L, with ski/board carry attachments",
      "Pack liner — a rubbish bag is fine",
    ]},
  ];

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function defaultState() {
    const checklist = {};
    CHECKLIST.forEach((group) => {
      group.items.forEach((item) => {
        checklist[slugify(item)] = { packed: false, who: null };
      });
    });
    return {
      tripDate: "",
      accommodation: "5 Slalom Place, Castle Hill",
      checklist,
      expenses: [],
      conditions: [],
      forfeits: [],
    };
  }

  function loadState() {
    const fromHash = readHash();
    if (fromHash) {
      saveState(fromHash);
      history.replaceState(null, "", location.pathname + location.search);
      return fromHash;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (e) { /* ignore corrupt storage */ }
    return defaultState();
  }

  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function readHash() {
    const m = location.hash.match(/^#s=(.+)$/);
    if (!m) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    } catch (e) {
      return null;
    }
  }

  function buildShareUrl(s) {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    return `${location.origin}${location.pathname}#s=${b64}`;
  }

  let state = loadState();
  function persist() { saveState(state); }

  // ---------- Tabs ----------

  function initTabs() {
    const btns = document.querySelectorAll(".tab-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("[data-panel]").forEach((panel) => {
            panel.hidden = panel.id !== `panel-${btn.dataset.tab}`;
        });
      });
    });
  }

  // ---------- Overview ----------

  function chipRow(container, options, selected, onSelect, extraClass) {
    container.innerHTML = "";
    options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (extraClass ? ` ${extraClass}` : "");
      if (extraClass === "chip-danger") chip.dataset.danger = opt;
      chip.textContent = opt;
      chip.setAttribute("aria-pressed", String(opt === selected));
      chip.addEventListener("click", () => onSelect(opt));
      container.appendChild(chip);
    });
  }

  function initOverview() {
    const dateInput = document.getElementById("trip-date");
    const accomInput = document.getElementById("accom-input");
    dateInput.value = state.tripDate || "";
    accomInput.value = state.accommodation || "";

    dateInput.addEventListener("change", () => {
      state.tripDate = dateInput.value;
      persist();
      renderCountdown();
    });

    accomInput.addEventListener("input", () => {
      state.accommodation = accomInput.value;
      persist();
    });

    document.getElementById("share-btn").addEventListener("click", async () => {
      const url = buildShareUrl(state);
      const status = document.getElementById("share-status");
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = "Link copied — send it in the group chat";
      } catch (e) {
        status.textContent = url;
      }
      setTimeout(() => { status.textContent = ""; }, 6000);
    });

    renderCountdown();
    setInterval(renderCountdown, 30000);
  }

  function renderCountdown() {
    const note = document.getElementById("countdown-note");
    const daysEl = document.getElementById("cd-days");
    const hoursEl = document.getElementById("cd-hours");
    const minsEl = document.getElementById("cd-mins");

    if (!state.tripDate) {
      daysEl.textContent = "--";
      hoursEl.textContent = "--";
      minsEl.textContent = "--";
      note.textContent = "Set your departure time to start the countdown.";
      return;
    }

    const target = new Date(state.tripDate).getTime();
    const diff = target - Date.now();

    if (diff <= 0) {
      daysEl.textContent = "0";
      hoursEl.textContent = "0";
      minsEl.textContent = "0";
      note.textContent = "You're on the mountain. Ride safe.";
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    daysEl.textContent = String(days);
    hoursEl.textContent = String(hours);
    minsEl.textContent = String(mins);
    note.textContent = "Until wheels roll.";
  }

  function renderStats() {
    const allIds = Object.keys(state.checklist);
    const packed = allIds.filter((id) => state.checklist[id].packed).length;
    const pct = allIds.length ? Math.round((packed / allIds.length) * 100) : 0;
    document.getElementById("stat-packed").textContent = `${pct}%`;

    const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById("stat-spend").textContent = `$${total.toFixed(0)}`;
  }

  // ---------- Checklist ----------

  function renderChecklist() {
    const root = document.getElementById("checklist-categories");
    root.innerHTML = "";

    CHECKLIST.forEach((group) => {
      const wrap = document.createElement("div");
      wrap.className = "checklist-cat";

      const title = document.createElement("p");
      title.className = "checklist-cat-title";
      title.textContent = group.cat;
      wrap.appendChild(title);

      const list = document.createElement("ul");
      list.className = "checklist-items";

      group.items.forEach((itemText) => {
        const id = slugify(itemText);
        const entry = state.checklist[id] || { packed: false, who: null };

        const li = document.createElement("li");
        li.className = "checklist-item" + (entry.packed ? " is-packed" : "");

        const row = document.createElement("div");
        row.className = "checklist-item-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = entry.packed;
        checkbox.id = `chk-${id}`;
        checkbox.addEventListener("change", () => {
          state.checklist[id].packed = checkbox.checked;
          li.classList.toggle("is-packed", checkbox.checked);
          persist();
          renderStats();
        });

        const label = document.createElement("label");
        label.className = "checklist-item-text";
        label.htmlFor = checkbox.id;
        label.textContent = itemText;

        row.appendChild(checkbox);
        row.appendChild(label);
        li.appendChild(row);

        const assignees = document.createElement("div");
        assignees.className = "checklist-assignees";
        chipRow(assignees, PEOPLE, entry.who, (person) => {
          const newWho = state.checklist[id].who === person ? null : person;
          state.checklist[id].who = newWho;
          persist();
          renderChecklist();
        });
        li.appendChild(assignees);

        list.appendChild(li);
      });

      wrap.appendChild(list);
      root.appendChild(wrap);
    });
  }

  // ---------- Costs ----------

  function renderExpensePayerChips() {
    const container = document.getElementById("exp-payer-chips");
    chipRow(container, PEOPLE, container.dataset.selected || null, (person) => {
      container.dataset.selected = container.dataset.selected === person ? "" : person;
      renderExpensePayerChips();
    });
  }

  function initCosts() {
    renderExpensePayerChips();

    document.getElementById("expense-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const desc = document.getElementById("exp-desc");
      const amount = document.getElementById("exp-amount");
      const payerContainer = document.getElementById("exp-payer-chips");
      const payer = payerContainer.dataset.selected;

      if (!payer) {
        payerContainer.animate(
          [{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
          { duration: 200 }
        );
        return;
      }

      state.expenses.push({
        id: `${Date.now()}`,
        desc: desc.value.trim() || "Untitled",
        amount: parseFloat(amount.value) || 0,
        payer,
      });
      persist();

      desc.value = "";
      amount.value = "";
      delete payerContainer.dataset.selected;
      renderExpensePayerChips();
      renderExpenses();
      renderStats();
    });

    renderExpenses();
  }

  function renderExpenses() {
    const tbody = document.getElementById("expense-rows");
    tbody.innerHTML = "";

    if (state.expenses.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No expenses logged yet.</td></tr>';
      renderSettlement();
      return;
    }

    state.expenses.forEach((exp) => {
      const tr = document.createElement("tr");

      const descTd = document.createElement("td");
      descTd.textContent = exp.desc;

      const amountTd = document.createElement("td");
      amountTd.className = "amount-cell";
      amountTd.textContent = `$${exp.amount.toFixed(2)}`;

      const payerTd = document.createElement("td");
      payerTd.textContent = exp.payer;

      const actionTd = document.createElement("td");
      const del = document.createElement("button");
      del.className = "row-delete";
      del.type = "button";
      del.setAttribute("aria-label", `Remove ${exp.desc}`);
      del.textContent = "✕";
      del.addEventListener("click", () => {
        state.expenses = state.expenses.filter((e) => e.id !== exp.id);
        persist();
        renderExpenses();
        renderStats();
      });
      actionTd.appendChild(del);

      tr.append(descTd, amountTd, payerTd, actionTd);
      tbody.appendChild(tr);
    });

    renderSettlement();
  }

  function computeBalances() {
    const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const share = total / PEOPLE.length;

    const paid = {};
    PEOPLE.forEach((p) => { paid[p] = 0; });
    state.expenses.forEach((e) => { paid[e.payer] += e.amount; });

    return PEOPLE.map((p) => ({ person: p, balance: paid[p] - share }));
  }

  function biggestDebtor() {
    if (state.expenses.length === 0) return null;
    const balances = computeBalances();
    const sorted = [...balances].sort((a, b) => a.balance - b.balance);
    return sorted[0].balance < -0.01 ? sorted[0].person : null;
  }

  function renderSettlement() {
    const root = document.getElementById("settlement-list");
    root.innerHTML = "";

    if (state.expenses.length === 0) {
      root.innerHTML = '<p class="muted-copy">Add an expense to see the split.</p>';
      return;
    }

    const balances = computeBalances();
    const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance);

    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci];
      const d = debtors[di];
      const amt = Math.min(c.balance, -d.balance);
      transfers.push({ from: d.person, to: c.person, amount: amt });
      c.balance -= amt;
      d.balance += amt;
      if (c.balance < 0.01) ci++;
      if (d.balance > -0.01) di++;
    }

    if (transfers.length === 0) {
      root.innerHTML = '<p class="muted-copy">Everyone’s square.</p>';
      return;
    }

    transfers.forEach((t) => {
      const line = document.createElement("div");
      line.className = "settlement-line";
      line.innerHTML = `<span>${t.from} owes ${t.to}</span><span class="settlement-amount">$${t.amount.toFixed(2)}</span>`;
      root.appendChild(line);
    });
  }

  // ---------- Conditions ----------

  function renderDangerChips() {
    const container = document.getElementById("danger-chips");
    chipRow(container, DANGER_LEVELS, container.dataset.selected || null, (level) => {
      container.dataset.selected = container.dataset.selected === level ? "" : level;
      renderDangerChips();
    }, "chip-danger");
  }

  function renderCondWhoChips() {
    const container = document.getElementById("cond-who-chips");
    chipRow(container, PEOPLE, container.dataset.selected || null, (person) => {
      container.dataset.selected = container.dataset.selected === person ? "" : person;
      renderCondWhoChips();
    });
  }

  function initConditions() {
    renderDangerChips();
    renderCondWhoChips();

    document.getElementById("conditions-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const dangerContainer = document.getElementById("danger-chips");
      const whoContainer = document.getElementById("cond-who-chips");
      const danger = dangerContainer.dataset.selected;
      const who = whoContainer.dataset.selected;
      const freezing = document.getElementById("cond-freezing");
      const wind = document.getElementById("cond-wind");
      const notes = document.getElementById("cond-notes");

      if (!danger || !who) {
        ev.target.animate(
          [{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
          { duration: 200 }
        );
        return;
      }

      state.conditions.unshift({
        id: `${Date.now()}`,
        date: new Date().toISOString(),
        danger,
        freezing: freezing.value.trim(),
        wind: wind.value.trim(),
        notes: notes.value.trim(),
        who,
      });
      persist();

      freezing.value = "";
      wind.value = "";
      notes.value = "";
      delete dangerContainer.dataset.selected;
      delete whoContainer.dataset.selected;
      renderDangerChips();
      renderCondWhoChips();
      renderConditionsLog();
    });

    renderConditionsLog();
  }

  function renderConditionsLog() {
    const root = document.getElementById("conditions-log");
    root.innerHTML = "";

    if (state.conditions.length === 0) {
      root.innerHTML = '<p class="muted-copy">Nothing logged yet.</p>';
      return;
    }

    state.conditions.forEach((c) => {
      const entry = document.createElement("div");
      entry.className = "condition-entry";

      const dateStr = new Date(c.date).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });

      const head = document.createElement("div");
      head.className = "condition-entry-head";
      const badge = document.createElement("span");
      badge.className = `condition-badge condition-badge-${slugify(c.danger)}`;
      badge.textContent = c.danger;
      const meta = document.createElement("span");
      meta.className = "condition-meta";
      meta.textContent = dateStr;
      head.append(badge, meta);
      entry.appendChild(head);

      const detailBits = [];
      if (c.freezing) detailBits.push(`Freezing level: ${c.freezing}`);
      if (c.wind) detailBits.push(`Wind: ${c.wind}`);
      if (detailBits.length) {
        const detail = document.createElement("p");
        detail.className = "condition-detail";
        detail.textContent = detailBits.join(" · ");
        entry.appendChild(detail);
      }
      if (c.notes) {
        const notesP = document.createElement("p");
        notesP.className = "condition-detail";
        notesP.textContent = c.notes;
        entry.appendChild(notesP);
      }

      const by = document.createElement("p");
      by.className = "condition-by";
      by.textContent = `Logged by ${c.who}`;
      entry.appendChild(by);

      root.appendChild(entry);
    });
  }

  // ---------- Forfeits ----------

  function isVip(person) {
    return localStorage.getItem(VIP_KEY) === person;
  }

  function renderForfeitWhoChips() {
    const container = document.getElementById("forfeit-who-chips");
    const current = container.dataset.selected || biggestDebtor() || PEOPLE[0];
    chipRow(container, PEOPLE, current, (person) => {
      container.dataset.selected = person;
      renderForfeitWhoChips();
    });
  }

  function pickTier() {
    const roll = Math.random();
    if (roll < 0.6) return "savage";
    if (roll < 0.85) return "medium";
    return "mild";
  }

  function initForfeits() {
    renderForfeitWhoChips();
    renderForfeitLog();

    document.getElementById("forfeit-draw-btn").addEventListener("click", () => {
      const who = document.getElementById("forfeit-who-chips").dataset.selected || biggestDebtor() || PEOPLE[0];
      const tier = isVip(who) ? "mild" : pickTier();
      const pool = FORFEIT_POOL[tier];
      const text = pool[Math.floor(Math.random() * pool.length)];

      state.forfeits.unshift({ id: `${Date.now()}`, who, tier, text, ts: new Date().toISOString() });
      persist();

      const reveal = document.getElementById("forfeit-reveal");
      const badge = document.getElementById("forfeit-tier-badge");
      badge.className = `forfeit-tier-badge tier-${tier}`;
      badge.textContent = tier;
      document.getElementById("forfeit-text").textContent = `${who}: ${text}`;
      reveal.hidden = false;

      renderForfeitLog();
    });

    // Secret unlock: 5 taps on the title within 2s rigs draws for Camshaft to
    // always land mild. Device-local only, never included in shared state.
    let tapTimes = [];
    document.getElementById("brand-title").addEventListener("click", () => {
      const now = Date.now();
      tapTimes = tapTimes.filter((t) => now - t < 2000);
      tapTimes.push(now);
      if (tapTimes.length >= 5) {
        tapTimes = [];
        const rigged = localStorage.getItem(VIP_KEY) === "Camshaft";
        if (rigged) localStorage.removeItem(VIP_KEY);
        else localStorage.setItem(VIP_KEY, "Camshaft");
        const title = document.getElementById("brand-title");
        title.classList.remove("brand-pulse");
        void title.offsetWidth;
        title.classList.add("brand-pulse");
      }
    });
  }

  function renderForfeitLog() {
    const root = document.getElementById("forfeit-log");
    root.innerHTML = "";

    if (state.forfeits.length === 0) {
      root.innerHTML = '<p class="muted-copy">No forfeits drawn yet.</p>';
      return;
    }

    state.forfeits.forEach((f) => {
      const entry = document.createElement("div");
      entry.className = "forfeit-entry";

      const head = document.createElement("div");
      head.className = "forfeit-entry-head";
      const who = document.createElement("span");
      who.className = "forfeit-entry-who";
      who.textContent = f.who;
      const badge = document.createElement("span");
      badge.className = `forfeit-tier-badge tier-${f.tier}`;
      badge.textContent = f.tier;
      head.append(who, badge);
      entry.appendChild(head);

      const text = document.createElement("p");
      text.className = "forfeit-entry-text";
      text.textContent = f.text;
      entry.appendChild(text);

      root.appendChild(entry);
    });
  }

  // ---------- Init ----------

  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initOverview();
    renderChecklist();
    initCosts();
    initConditions();
    initForfeits();
    renderStats();
  });
})();
