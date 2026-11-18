// paper radar — static front end. Views: #/ (today or #/day/<date>), #/archive, #/notes
"use strict";
const REPO = "Furyton/paper-radar";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cache = {};
async function get(path) {
  if (!cache[path]) cache[path] = fetch(path, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null));
  return cache[path];
}
const abs = (id) => `https://arxiv.org/abs/${id}`;
const authors = (a, n = 8) => (a || []).length > n ? a.slice(0, n).join(", ") + ` +${a.length - n}` : (a || []).join(", ");
// Author list as HTML: followed researchers in bold, always visible even past
// the cut-off; the rest of a long list opens with "+N more".
const nameKey = (s) => { const p = String(s).normalize("NFKD").replace(/[^A-Za-z ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);
  return p.length < 2 ? [p.join(" ")] : [p[0] + " " + p[p.length - 1], p[p.length - 1] + " " + p[0]]; };
function authorsHtml(a, who = [], n = 8) {
  a = a || [];
  const wk = new Set(who.flatMap(nameKey));
  const isW = (x) => nameKey(x).some((k) => wk.has(k));
  const fmt = (x) => isW(x) ? `<b class="me">${esc(x)}</b>` : esc(x);
  if (a.length <= n) return a.map(fmt).join(", ");
  const head = a.slice(0, n), tail = a.slice(n), late = tail.filter(isW);
  return head.map(fmt).join(", ") + (late.length ? ", … " + late.map(fmt).join(", ") : "") +
    ` <button class="more" onclick="this.hidden=true;this.nextElementSibling.hidden=false">+${tail.length} more</button>` +
    `<span hidden>; all authors: ${a.map(fmt).join(", ")}</span>`;
}
function authorsOf(p, n) {
  const h = authorsHtml(p.authors, p.who, n);
  return p.n_authors ? h + ` <span class="muted">(${p.n_authors} authors)</span>` : h;
}
const WHO = {};  // arxiv id -> followed researchers, from the archive index
async function loadWho() {
  if (Object.keys(WHO).length) return;
  ((await get("data/papers.json")) || []).forEach((p) => { if (p.arxiv && p.who && p.who.length) WHO[p.arxiv] = p.who; });
}
const TIER = { core: "★ core", interesting: "◆ interesting", aware: "○ aware" };

function issueLink(label, title, body) {
  const u = `https://github.com/${REPO}/issues/new?labels=feedback&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return `<a href="${u}" target="_blank" rel="noopener" title="${esc(label)}">${label}</a>`;
}
// "ask" / "idea" links open a prefilled issue in the private repo; the next daily run answers it
function askLink(label, title, body, labels = "question") {
  const u = `https://github.com/${REPO}/issues/new?labels=${labels}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return `<a class="ask" href="${u}" target="_blank" rel="noopener">${label}</a>`;
}
function feedback(p, date, extra = []) {
  const ctx = `paper: ${p.title}\narxiv: ${p.arxiv}\ntier given: ${p.tier || "-"}\ndate: ${date}\n\ncomment: `;
  const links = [
    issueLink("👍", `feedback: more like this ${p.arxiv}`, `verdict: good pick\n${ctx}`),
    issueLink("👎", `feedback: not for me ${p.arxiv}`, `verdict: bad pick\n${ctx}`),
    ...extra,
  ];
  return `<span class="fb">${links.join("")}</span>`;
}
function badges(p) {
  const b = [];
  if (p.venue) b.push(`<span class="b venue">${esc(p.venue)}</span>`);
  (p.tags || []).forEach((t) => b.push(`<span class="b">${esc(t)}</span>`));
  (p.sources || []).forEach((s) => b.push(`<span class="b src">${esc(s)}</span>`));
  (p.ideas || []).forEach((s) => b.push(`<span class="b">💡 idea</span>`));
  if (p.zotero) b.push(`<span class="b">zotero: ${esc(p.zotero)}</span>`);
  return b.join("");
}
function card(p, date) {
  return `<div class="card ${esc(p.tier)}">
    <div class="t"><a href="${abs(p.arxiv)}" target="_blank" rel="noopener">${esc(p.title)}</a></div>
    <div class="au">${authorsHtml(p.authors, WHO[p.arxiv])}</div>
    ${p.summary ? `<div class="sum">${esc(p.summary)}</div>` : ""}
    ${p.why ? `<div class="why">${esc(p.why)}</div>` : ""}
    ${absToggle(p.arxiv)}
    <div class="meta">${badges(p)}${feedback(p, date)}</div></div>`;
}
function awareTable(ps, date) {
  return `<table><tr><th>Paper</th><th class="hide-sm">Kind</th><th>Note</th><th></th></tr>${ps.map((p) => `<tr>
    <td><a href="${abs(p.arxiv)}" target="_blank" rel="noopener">${esc(p.title)}</a><div class="au">${authorsHtml(p.authors, WHO[p.arxiv], 4)}</div></td>
    <td class="k hide-sm">${esc([p.venue, ...(p.tags || [])].filter(Boolean).join(" · "))}</td>
    <td class="small">${esc(p.summary || "")}</td><td>${feedback(p, date)}</td></tr>`).join("")}</table>`;
}
function section(title, n, inner) {
  return n ? `<h2>${title} <span class="count">${n}</span></h2>${inner}` : "";
}

async function viewDay(date) {
  const days = (await get("data/days.json")) || [];
  if (!days.length) return `<h1>No digests yet</h1><p class="muted">The first daily run has not happened.</p>`;
  date = date || days[0].date;
  const d = await get(`data/day/${date}.json`);
  await loadWho();
  if (!d) return `<p>No digest for ${esc(date)}.</p>`;
  const i = days.findIndex((x) => x.date === date);
  const nav = `<div class="daynav">
    ${days[i + 1] ? `<a href="#/day/${days[i + 1].date}">← ${days[i + 1].date}</a>` : ""}
    <select onchange="location.hash='#/day/'+this.value">${days.map((x) => `<option ${x.date === date ? "selected" : ""}>${x.date}</option>`).join("")}</select>
    ${i > 0 ? `<a href="#/day/${days[i - 1].date}">${days[i - 1].date} →</a>` : ""}</div>`;
  const s = d.stats || {};
  const stats = `<p class="stats">${[
    s.arxiv_new && `${s.arxiv_new} new on arXiv (cs+stat)`, s.titles_read && `${s.titles_read} titles triaged`,
    s.abstracts_read && `${s.abstracts_read} abstracts read`, s.scholar_inbox && `${s.scholar_inbox} from Scholar Inbox`,
    s.curated && `${s.curated} curator picks`].filter(Boolean).join(" · ")}</p>`;
  const P = d.papers || [];
  const by = (t) => P.filter((p) => p.tier === t);
  const picks = (d.daily_picks || []).map((p) => `<details class="pick"><summary><span class="t">${esc(p.title)}</span>
      <span class="au"> — ${esc(authors(p.authors, 5))}${p.year ? `, ${esc(p.year)}` : ""}</span></summary>
      <div class="digest">${(p.digest || "").split(/\n\s*\n/).map((x) => `<p>${esc(x)}</p>`).join("")}</div>
      <p class="small">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">paper</a> · ` : ""}<a href="#/notes/${esc(p.note_key || "")}">full note</a></p></details>`).join("");
  const res = d.researchers || [];
  const resTable = `<table><tr><th>Researcher</th><th>Paper</th><th class="hide-sm">Evidence</th><th></th></tr>${res.map((r) => `<tr>
    <td class="k"><span class="b res">${esc(r.researcher)}</span></td>
    <td><a href="${abs(r.arxiv)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="au">${authorsHtml(r.authors, [r.researcher, ...(WHO[r.arxiv] || [])], 6)}</div>
      ${r.summary ? `<div class="small">${esc(r.summary)}</div>` : ""}</td>
    <td class="small hide-sm">${esc(r.evidence || "")}${r.verdict && r.verdict !== "confirmed" ? ` <span class="b">${esc(r.verdict)}</span>` : ""}</td>
    <td>${feedback({ ...r, tier: "researcher" }, date, [issueLink("🙅", `feedback: not this person ${r.arxiv}`, `verdict: wrong researcher match\nresearcher: ${r.researcher}\npaper: ${r.title}\narxiv: ${r.arxiv}\ndate: ${date}\n\ncomment: `)])}</td></tr>`).join("")}</table>`;
  return `<h1>${esc(date)}</h1>${nav}${stats}
    ${d.headline ? `<p>${esc(d.headline)}</p>` : ""}
    ${section("Daily deep-dive picks (from @study)", (d.daily_picks || []).length, picks)}
    ${section("Followed researchers", res.length, resTable)}
    ${section("★ Core", by("core").length, `<div class="grid">${by("core").map((p) => card(p, date)).join("")}</div>`)}
    ${section("◆ Interesting", by("interesting").length, `<div class="grid">${by("interesting").map((p) => card(p, date)).join("")}</div>`)}
    ${section("○ Aware", by("aware").length, awareTable(by("aware"), date))}`;
}

// Abstracts live in a separate file, fetched the first time one is opened.
function absToggle(id) {
  return `<details class="small abs" data-id="${esc(id)}" ontoggle="loadAbs(this)"><summary class="muted">abstract</summary><div class="abstext">…</div></details>`;
}
window.loadAbs = async (el) => {
  if (!el.open || el.dataset.done) return;
  const all = (await get("data/abstracts.json")) || {};
  const box = el.querySelector(".abstext");
  box.textContent = all[el.dataset.id] || "(no abstract available)";
  el.dataset.done = 1;
  if (window.renderMathInElement) renderMathInElement(box, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false });
};

// ---------------------------------------------------------------- Archive
// Every paper the radar knows: daily digests (★ ◆ ○, followed researchers),
// the library (Zotero @study + awesome list) and conference lists.
const ICON = { core: "★", interesting: "◆", aware: "○", researcher: "👤", library: "📚" };
const TIER_NAME = { all: "All", core: "★ Core", interesting: "◆ Interesting", aware: "○ Aware", researcher: "👤 Researchers", library: "📚 Library" };
const A = { q: "", tier: "all", src: "", venue: "", tag: "", who: "", sort: "date", page: 1 };
const PER_PAGE = 50;
const venueKey = (v) => ((v || "").match(/^[A-Za-z]+ \d{4}/) || [""])[0];
const linkOf = (p) => (p.arxiv ? abs(p.arxiv) : p.url || "#");
const RANK = { core: 0, researcher: 1, interesting: 2, aware: 3, library: 4 };

function chip(label, n, on, onclick) {
  return `<button class="${on ? "on" : ""}" onclick="${onclick}">${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ""}</button>`;
}
function countBy(rows, f) {
  const c = {};
  rows.forEach((r) => [].concat(f(r)).filter(Boolean).forEach((k) => (c[k] = (c[k] || 0) + 1)));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function archiveMatch(p, skip) {
  const terms = A.q.toLowerCase().split(/\s+/).filter(Boolean);
  return (skip === "tier" || A.tier === "all" || p.tier === A.tier) &&
    (skip === "src" || !A.src || p.src.includes(A.src)) &&
    (skip === "venue" || !A.venue || venueKey(p.venue) === A.venue) &&
    (skip === "tag" || !A.tag || (p.tags || []).includes(A.tag)) &&
    (skip === "who" || !A.who || (p.who || []).includes(A.who)) &&
    terms.every((t) => [p.title, (p.authors || []).join(" "), p.summary, p.abstract, (p.tags || []).join(" "), p.venue, p.arxiv].join(" ").toLowerCase().includes(t));
}
window.setA = (k, v) => { A[k] = A[k] === v && k !== "sort" && k !== "page" ? (k === "tier" ? "all" : "") : v; if (k !== "page") A.page = 1; archiveResults(); window.scrollTo({ top: 0 }); };

async function viewArchive() {
  return `<h1>Archive</h1>
    <p class="muted small">Every paper the radar knows: daily digests (★ core, ◆ interesting, ○ aware, followed researchers), your library (Zotero @study and the awesome list) and conference lists. Click any tag, source or venue to filter.</p>
    <div class="searchrow"><input id="aq" type="search" placeholder="Filter by title, author, abstract, tag…" value="${esc(A.q)}">
      <select id="asort"><option value="date">Newest first</option><option value="tier">Tier, then newest</option><option value="title">Title A–Z</option></select></div>
    <div id="ares"></div>`;
}
async function archiveResults() {
  const ps = (await get("data/papers.json")) || [];
  const box = $("#ares"); if (!box) return;
  const tierCounts = Object.fromEntries(countBy(ps.filter((p) => archiveMatch(p, "tier")), (p) => p.tier));
  const srcs = countBy(ps.filter((p) => archiveMatch(p, "src")), (p) => p.src);
  const venues = countBy(ps.filter((p) => archiveMatch(p, "venue")), (p) => venueKey(p.venue));
  const tags = countBy(ps.filter((p) => archiveMatch(p, "tag")), (p) => p.tags).slice(0, 24);
  const people = (await get("data/researchers.json")) || [];
  const nReview = ((await get("data/review.json")) || []).reduce((s, r) => s + r.cands.length, 0);
  const whoN = Object.fromEntries(countBy(ps.filter((p) => archiveMatch(p, "who")), (p) => p.who));
  const whoChips = people.map((r) => `<button class="${A.who === r.name ? "on" : ""}${whoN[r.name] ? "" : " zero"}" title="${esc(r.aff)}"
      onclick="A.peopleOpen=false;setA('who',${JSON.stringify(r.name).replace(/"/g, "&quot;")})">${esc(r.name)} <span class="n">${whoN[r.name] || 0}</span></button>`).join("");
  const hit = ps.filter((p) => archiveMatch(p));
  const by = { date: (a, b) => (b.date || "").localeCompare(a.date || ""),
               tier: (a, b) => (RANK[a.tier] - RANK[b.tier]) || (b.date || "").localeCompare(a.date || ""),
               title: (a, b) => a.title.localeCompare(b.title) }[A.sort];
  hit.sort(by);
  const pages = Math.max(1, Math.ceil(hit.length / PER_PAGE)); A.page = Math.min(A.page, pages);
  const rows = hit.slice((A.page - 1) * PER_PAGE, A.page * PER_PAGE);
  const pager = pages > 1 ? `<div class="pager">
      <button ${A.page <= 1 ? "disabled" : ""} onclick="setA('page',${A.page - 1})">← Prev</button>
      <span>Page ${A.page} / ${pages}</span>
      <button ${A.page >= pages ? "disabled" : ""} onclick="setA('page',${A.page + 1})">Next →</button></div>` : "";
  const q = (v) => JSON.stringify(v).replace(/"/g, "&quot;");
  box.innerHTML = `
    <div class="facet"><span class="fl">Tier</span>${["all", "core", "interesting", "aware", "researcher", "library"].map((t) =>
      chip(TIER_NAME[t], t === "all" ? null : tierCounts[t] || 0, A.tier === t, `setA('tier','${t}')`)).join("")}</div>
    <div class="facet"><span class="fl">Source</span>${srcs.map(([k, n]) => chip(k, n, A.src === k, `setA('src',${q(k)})`)).join("")}</div>
    ${venues.length ? `<div class="facet"><span class="fl">Venue</span>${venues.map(([k, n]) => chip(k, n, A.venue === k, `setA('venue',${q(k)})`)).join("")}</div>` : ""}
    <div class="facet"><span class="fl">Tag</span>${tags.map(([k, n]) => chip(k, n, A.tag === k, `setA('tag',${q(k)})`)).join("")}</div>
    <details class="facet people" ${A.peopleOpen ? "open" : ""} ontoggle="A.peopleOpen=this.open">
      <summary><span class="fl">People</span>${A.who ? `<button class="on" onclick="event.preventDefault();setA('who',${q(A.who)})">👤 ${esc(A.who)} ✕</button>` :
        `<span class="muted small">${people.length} followed researchers · ${people.filter((r) => whoN[r.name]).length} with papers here — click to pick one</span>`}
        ${nReview ? `<a class="small" href="#/review" onclick="event.stopPropagation()">· ${nReview} to check →</a>` : ""}</summary>
      <div class="pchips">${whoChips}</div></details>
    <p class="stats">${hit.length.toLocaleString()} paper${hit.length === 1 ? "" : "s"}${hit.length < ps.length ? ` (of ${ps.length.toLocaleString()})` : ""} · showing ${hit.length ? (A.page - 1) * PER_PAGE + 1 : 0}–${(A.page - 1) * PER_PAGE + rows.length}</p>
    ${pager}
    <div class="rows">${rows.map((p) => `<div class="row ${esc(p.tier)}">
      <div class="rt"><span class="ic" title="${esc(TIER_NAME[p.tier] || p.tier)}">${ICON[p.tier] || "·"}</span>
        <a href="${esc(linkOf(p))}" target="_blank" rel="noopener">${esc(p.title)}</a></div>
      <div class="au">${authorsOf(p, 8)}</div>
      <div class="meta"><span class="d">${p.listed ? `<a href="#/day/${p.date}" title="listed in this daily digest">${esc(p.date)}</a>` : esc(p.date || "—")}</span>
        ${(p.who || []).map((w) => `<button class="b res" onclick="setA('who',${q(w)})" title="followed researcher">👤 ${esc(w)}</button>`).join("")}
        ${p.venue ? `<button class="b venue" onclick="setA('venue',${q(venueKey(p.venue))})">${esc(p.venue)}</button>` : ""}
        ${(p.tags || []).map((t) => `<button class="b" onclick="setA('tag',${q(t)})">${esc(t)}</button>`).join("")}
        ${p.src.map((s) => `<button class="b src" onclick="setA('src',${q(s)})">${esc(s)}</button>`).join("")}
        ${p.note ? `<a class="b flag" href="#/notes/${esc(p.note)}" title="Claude deep-dive note">📝 note</a>` : ""}
        ${p.zotero && !p.src.includes("Zotero") ? `<span class="b flag" title="in your Zotero library">✓ Zotero</span>` : ""}
        ${p.arxiv ? askLink("💡", `idea: add paper ${p.arxiv}`, `paper: ${p.arxiv} ${p.title}\nidea: (which idea, or "new: <name>")\n\nwhy:\n`, "idea") + askLink("❓", `question: ${p.title}`, `paper: ${p.arxiv} ${p.title}\n\nMy question:\n\n`) : ""}</div>
      ${p.summary ? `<div class="sum">${esc(p.summary)}</div>` : ""}
      ${p.has_abs ? absToggle(p.id) : ""}
    </div>`).join("")}</div>
    ${pager}`;
  typeset(box);
}
function wireArchive() {
  const aq = $("#aq"), so = $("#asort");
  so.value = A.sort;
  let t; aq.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { A.q = aq.value.trim(); A.page = 1; archiveResults(); }, 200); });
  so.addEventListener("change", () => setA("sort", so.value));
  archiveResults();
}

// ---------------------------------------------------------------- Notes
// Desktop: a sticky sidebar (search + every note, grouped by month, its own scroll)
// and a reader with prev/next, a section outline and collapsible sections.
// Switching notes only swaps the reader, so the list never jumps.
// Keys: ←/→ or j/k prev/next · / search · e expand/collapse all · 1–9 jump to section · Esc leave search.
const N = { q: "", open: null, hit: [], sort: "date" };
async function viewNotes(open) {
  N.open = open || null;
  return `<div class="notes-layout"><aside id="nside">
      <div class="nsearch"><input id="nq" type="search" placeholder="Search notes…  ( / )" value="${esc(N.q)}">
        <div class="nmeta"><span id="ncount"></span>
          <select id="nsort"><option value="date">newest</option><option value="title">A–Z</option></select></div></div>
      <div id="nlist"></div></aside>
    <article id="nread" class="reader"><p class="muted">Pick a note on the left.</p></article></div>`;
}
async function allNotes() {
  const ns = (await get("data/notes.json")) || [];
  N.all = ns;
  if (!ns._text) ns.forEach((n) => (n._text = (n.title + " " + n.authors.join(" ") + " " + n.tags.join(" ") + " " + n.html.replace(/<[^>]+>/g, " ")).toLowerCase()));
  return ns;
}
async function notesList() {
  const ns = await allNotes();
  const terms = N.q.toLowerCase().split(/\s+/).filter(Boolean);
  N.hit = ns.filter((n) => terms.every((t) => n._text.includes(t)));
  if (N.sort === "title") N.hit = [...N.hit].sort((a, b) => a.title.localeCompare(b.title));
  $("#ncount").textContent = `${N.hit.length} of ${ns.length}`;
  let last = "";
  $("#nlist").innerHTML = N.hit.map((n) => {
    const g = N.sort === "date" ? (n.added || "").slice(0, 7) : n.title.slice(0, 1).toUpperCase();
    const head = g !== last ? `<div class="ngroup">${esc(g)}</div>` : "";
    last = g;
    return `${head}<a class="nitem ${n.key === N.open ? "on" : ""}" data-key="${esc(n.key)}" href="#/notes/${esc(n.key)}">
      <span class="t">${esc(n.title)}</span><span class="au">${esc(authors(n.authors, 3))} · ${esc(n.added)}</span></a>`;
  }).join("") || `<p class="muted small">No match.</p>`;
  typeset($("#nlist"));
  if (!N.open && window.innerWidth > 900 && N.hit[0]) N.open = N.hit[0].key;
  openNote(N.open, false);
}
function openNote(key, scrollList = true) {
  const reader = $("#nread"); if (!reader) return;
  N.open = key;
  document.querySelectorAll("#nlist .nitem").forEach((a) => a.classList.toggle("on", a.dataset.key === key));
  const cur = N.hit.find((n) => n.key === key) || (N.all || []).find((n) => n.key === key);
  const reading = !!cur;
  $(".notes-layout").classList.toggle("reading", reading && location.hash.includes("/notes/"));
  document.body.classList.toggle("notes-open", reading && location.hash.includes("/notes/"));
  if (!cur) return;
  const i = N.hit.findIndex((n) => n.key === key);
  const prev = i > 0 ? N.hit[i - 1] : null, next = i >= 0 && i < N.hit.length - 1 ? N.hit[i + 1] : null;
  reader.innerHTML = `<div class="rtools small">
      <button class="back" onclick="closeNote()">← All notes</button>
      <button class="nav" ${prev ? "" : "disabled"} title="previous (← or k)" onclick="stepNote(-1)">‹ prev</button>
      <span class="pos">${i >= 0 ? `${i + 1} / ${N.hit.length}` : ""}</span>
      <button class="nav" ${next ? "" : "disabled"} title="next (→ or j)" onclick="stepNote(1)">next ›</button>
      <span class="sp"></span>
      ${cur.url ? `<a href="${esc(cur.url)}" target="_blank" rel="noopener">paper ↗</a>` : ""}
      ${askLink("❓ ask", `question: ${cur.title}`, `note: ${cur.key}\npaper: ${cur.title}\n${cur.url || ""}\n\nMy question (quote the part you mean):\n\n`)}
      <button class="nav" title="expand / collapse all sections (e)" onclick="toggleSections()">⇕ sections</button></div>
    <div class="outline small" id="noutline"></div>
    <div class="body"></div>
    <p class="keys small muted">Keys: ← → or j k previous / next · / search · e expand or collapse · 1–9 jump to a section · Esc leave the search box</p>`;
  const body = reader.querySelector(".body");
  body.innerHTML = cur.html;  // isolated: stray tags cannot leak into the page
  sectionize(body);
  typeset(reader);
  const outline = $("#noutline");
  const secs = [...body.querySelectorAll("details.sec")];
  outline.innerHTML = `<span class="muted">noted ${esc(cur.added)}</span>` + secs.map((d, k) =>
    `<a href="javascript:void 0" onclick="gotoSection(${k})"><b>${k + 1}</b> ${esc(d.querySelector("summary").textContent)}</a>`).join("");
  if (window.innerWidth > 900) {
    const top = $(".notes-layout").getBoundingClientRect().top + window.scrollY - 60;
    if (window.scrollY > top) window.scrollTo({ top });
  } else window.scrollTo({ top: 0 });
  if (scrollList) {
    const el = document.querySelector(`#nlist .nitem[data-key="${CSS.escape(key)}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
}
function sectionize(body) {
  // wrap each <h3> and what follows it (until the next h2/h3) in a collapsible <details>
  const kids = [...body.childNodes];
  let cur = null;
  kids.forEach((node) => {
    const tag = node.nodeType === 1 ? node.tagName : "";
    if (tag === "H3") {
      cur = document.createElement("details");
      cur.className = "sec"; cur.open = true;
      const s = document.createElement("summary");
      s.innerHTML = node.innerHTML;
      cur.appendChild(s);
      body.insertBefore(cur, node);
      node.remove();
    } else if (tag === "H2") {
      cur = null;
    } else if (cur) {
      cur.appendChild(node);
    }
  });
}
window.gotoSection = (k) => {
  const d = document.querySelectorAll("#nread details.sec")[k];
  if (!d) return;
  d.open = true;
  const y = d.getBoundingClientRect().top + window.scrollY - (window.innerWidth > 900 ? 70 : 110);
  window.scrollTo({ top: y, behavior: "smooth" });
};
window.toggleSections = () => {
  const ds = [...document.querySelectorAll("#nread details.sec")];
  const open = !ds.every((d) => d.open);
  ds.forEach((d) => (d.open = open));
};
window.stepNote = (d) => {
  const i = N.hit.findIndex((n) => n.key === N.open);
  const n = N.hit[i + d];
  if (n) location.hash = `#/notes/${n.key}`;
};
window.closeNote = () => { N.open = null; document.body.classList.remove("notes-open"); location.hash = "#/notes"; };
function wireNotes() {
  const nq = $("#nq"), so = $("#nsort");
  so.value = N.sort;
  let t; nq.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { N.q = nq.value.trim(); notesList(); }, 200); });
  nq.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && N.hit[0]) { location.hash = `#/notes/${N.hit[0].key}`; nq.blur(); }
    if (e.key === "Escape") nq.blur();
  });
  so.addEventListener("change", () => { N.sort = so.value; notesList(); });
  notesList();
}
document.addEventListener("keydown", (e) => {
  if (!$("#nside") || e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || "");
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); $("#nq").focus(); $("#nq").select(); }
  else if (e.key === "ArrowRight" || e.key === "j") { e.preventDefault(); stepNote(1); }
  else if (e.key === "ArrowLeft" || e.key === "k") { e.preventDefault(); stepNote(-1); }
  else if (e.key === "e") toggleSections();
  else if (/^[1-9]$/.test(e.key)) gotoSection(+e.key - 1);
});


// ---------------------------------------------------------------- Review
// Researcher matches the radar is unsure about (same name, no known co-author).
// Shiguang marks ✓ / ✗; "Submit" opens one GitHub issue that the daily task applies
// (scripts/apply_review.py): ✓ papers join the person and teach new co-authors, ✗ never return.
const R = (() => { try { return JSON.parse(localStorage.getItem("radar-review") || "{}"); } catch (e) { return {}; } })();
const saveR = () => { try { localStorage.setItem("radar-review", JSON.stringify(R)); } catch (e) { /* storage off */ } };
const rkey = (aid, name) => aid + "|" + name;
window.setR = (aid, name, v) => { const k = rkey(aid, name); R[k] = R[k] === v ? undefined : v; if (!R[k]) delete R[k]; saveR(); reviewList(); };
window.setRAll = (name, v) => { REV.filter((r) => r.cands.some((c) => c.name === name)).forEach((r) => { if (!R[rkey(r.arxiv, name)]) R[rkey(r.arxiv, name)] = v; }); saveR(); reviewList(); };
let REV = [];
const RV = { who: "" };
async function viewReview(who) {
  RV.who = who ? decodeURIComponent(who) : "";
  return `<h1>Check researcher matches</h1>
    <p class="muted small">Papers by someone with the same name as a followed researcher, where no known co-author confirms it.
    Mark ✓ (it is them) or ✗ (someone else), then <b>Submit</b>: it opens a GitHub issue that the daily run applies.
    ✓ papers are added and their co-authors are learned, so later papers with the same collaborators are accepted automatically; ✗ papers never come back.
    Sorted by topic fit with the person's known papers. Your marks are kept in this browser until submitted.</p>
    <div id="rvlist"></div>`;
}
async function reviewList() {
  REV = (await get("data/review.json")) || [];
  const people = (await get("data/researchers.json")) || [];
  const info = Object.fromEntries(people.map((p) => [p.name, p]));
  const by = {};
  REV.forEach((r) => r.cands.forEach((c) => (by[c.name] = by[c.name] || []).push({ ...r, topic: c.topic, n: c.n })));
  const names = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  const marked = Object.keys(R).length;
  const q = (v) => JSON.stringify(v).replace(/"/g, "&quot;");
  const box = $("#rvlist"); if (!box) return;
  if (!names.length) { box.innerHTML = `<p>Nothing to check right now.</p>`; return; }
  const show = RV.who && by[RV.who] ? [RV.who] : names;
  box.innerHTML = `<div class="facet"><span class="fl">People</span>${names.map((n) =>
      chip(n, by[n].filter((r) => !R[rkey(r.arxiv, n)]).length, RV.who === n, `location.hash='#/review/'+encodeURIComponent(${q(n)})`)).join("")}</div>
    ${show.map((n) => {
      const p = info[n] || {};
      const rows = by[n].sort((a, b) => b.topic - a.topic);
      return `<section class="rvp"><h2>${esc(n)} <span class="count">${rows.length}</span></h2>
        <p class="small muted">Followed as: ${esc(p.aff || "?")}${p.co && p.co.length ? ` · confirmed co-authors: ${esc(p.co.join(", "))}` : ""}${p.co_auto && p.co_auto.length ? ` · co-authors guessed from arXiv/OpenAlex (may be wrong): ${esc(p.co_auto.join(", "))}` : ""}
        · <a href="#/archive" onclick="A.who=${q(n)};A.tier='all';A.page=1">their confirmed papers (${p.n || 0})</a></p>
        <p class="small"><button class="rb" onclick="setRAll(${q(n)},'-')">mark all unmarked ✗</button></p>
        ${rows.map((r) => { const v = R[rkey(r.arxiv, n)]; return `<div class="rvrow ${v === "+" ? "yes" : v === "-" ? "no" : ""}">
          <div class="rvbtn"><button class="${v === "+" ? "on" : ""}" title="yes, this is ${esc(n)}" onclick="setR('${r.arxiv}',${q(n)},'+')">✓</button>
            <button class="${v === "-" ? "on" : ""}" title="someone else" onclick="setR('${r.arxiv}',${q(n)},'-')">✗</button></div>
          <div class="rvmain"><a href="${abs(r.arxiv)}" target="_blank" rel="noopener">${esc(r.title)}</a>
            <div class="au">${authorsHtml(r.authors, [n], 10)}</div>
            <div class="small muted">${esc(r.date)} · ${esc(r.cat)} · topic fit ${r.topic.toFixed(2)}${r.n > 30 ? ` · ${r.n} authors` : ""}
              · <a href="https://arxiv.org/html/${r.arxiv}" target="_blank" rel="noopener">affiliations ↗</a></div>
            ${absToggle(r.arxiv)}</div></div>`; }).join("")}</section>`;
    }).join("")}
    <div class="rvsubmit"><span>${marked} marked</span>
      <button ${marked ? "" : "disabled"} onclick="submitReview()">Submit as GitHub issue</button>
      <button ${marked ? "" : "disabled"} onclick="if(confirm('Clear all marks?')){for(const k in R)delete R[k];saveR();reviewList()}">clear</button></div>`;
  typeset(box);
}
window.submitReview = () => {
  const lines = Object.entries(R).map(([k, v]) => { const [aid, name] = k.split("|"); return `${v} ${aid} | ${name}`; });
  let body = "Verdicts from #/review (+ = it is them, - = someone else):\n\n", used = [];
  for (const l of lines) { if (encodeURIComponent(body + l + "\n").length > 6500) break; body += l + "\n"; used.push(l); }
  const u = `https://github.com/${REPO}/issues/new?labels=review&title=${encodeURIComponent(`review: researcher matches (${used.length})`)}&body=${encodeURIComponent(body)}`;
  window.open(u, "_blank", "noopener");
  if (used.length < lines.length) alert(`Too many for one issue: ${used.length} of ${lines.length} went in. Submit that issue, then press Submit again for the rest.`);
  used.forEach((l) => { const m = l.match(/^[+-] (\S+) \| (.+)$/); if (m) delete R[rkey(m[1], m[2])]; });
  saveR(); setTimeout(reviewList, 300);
};

async function render() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  const q = $("#q").value.trim();
  let view = h[0] || "today";
  if (view === "day") view = "today";
  if (q && view !== "notes") { view = "archive"; A.q = q; }
  document.querySelectorAll("nav a[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === view));
  if (view !== "notes") document.body.classList.remove("notes-open");
  if (view === "notes" && $("#nside") && !q) {  // already on Notes: only swap the reader
    N.open = h[1] || null;
    if (N.open) openNote(N.open); else { $(".notes-layout").classList.remove("reading"); document.body.classList.remove("notes-open"); }
    return;
  }
  const html = view === "archive" ? await viewArchive() : view === "notes" ? await viewNotes(h[1])
    : view === "review" ? await viewReview(h[1]) : await viewDay(h[0] === "day" ? h[1] : null);
  $("#app").innerHTML = html;
  if (view === "archive") wireArchive();
  else if (view === "review") reviewList();
  else if (view === "notes") wireNotes();
  else typeset($("#app"));
}

// LaTeX in notes, titles and abstracts ($...$, $$...$$, \(...\), \[...\]) via KaTeX.
// Long note pages are typeset lazily: each <details> when it is first opened.
function typeset(root) {
  if (!window.renderMathInElement) { setTimeout(() => typeset(root), 200); return; }
  const opts = {
    delimiters: [
      { left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false, errorColor: "#8a8a8a", ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
  };
  // Typeset everything visible now; closed <details> (abstracts, long digests) on first open.
  const closed = [...root.querySelectorAll("details:not([open])")];
  closed.forEach((d) => (d.dataset.skip = 1));
  renderMathInElement(root, { ...opts, ignoredClasses: ["skip-tex"] });
  root.querySelectorAll("details").forEach((d) => {
    const go = () => { if (!d.dataset.tex) { d.dataset.tex = 1; renderMathInElement(d, opts); } };
    if (d.open) go(); else d.addEventListener("toggle", go, { once: true });
  });
}
let timer;
$("#q").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const v = $("#q").value.trim();
    if (location.hash.startsWith("#/notes")) { N.q = v; const nq = $("#nq"); if (nq) nq.value = v; notesList(); return; }
    A.q = v; A.page = 1;
    if (location.hash.startsWith("#/archive") && $("#aq")) { $("#aq").value = v; archiveResults(); } else location.hash = "#/archive";
  }, 250);
});
// sticky offsets follow the real header height (it wraps to two rows on phones)
const setHdr = () => { const t = document.querySelector(".top"); if (t) document.documentElement.style.setProperty("--hdr", t.getBoundingClientRect().height + "px"); };
window.addEventListener("resize", setHdr); setHdr();
window.addEventListener("hashchange", render);
render();
