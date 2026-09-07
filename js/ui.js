/**
 * UI rendering helpers — result cards, filters, similarity explanation,
 * toast notifications. Pure DOM building; no routing or state.
 */
const UI = (() => {
  /** Escape HTML to prevent XSS from API data. */
  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  /** Create an element with attributes and children. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const child of children) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  /** Format a large number (e.g. 12500 -> "12,500"). */
  function fmt(n) {
    return n == null ? "—" : Number(n).toLocaleString("en-US");
  }

  /** OpenAlex ID short form, e.g. "A5023888391" from full URL. */
  function shortId(url) {
    return url && url.includes("openalex.org") ? url.split("/").pop() : url;
  }

  /** Author hash link. */
  function authorHref(id) {
    return `#/author/${shortId(id)}`;
  }

  /* ---------------------------------------------------------------------
   * Work (paper) card
   * ------------------------------------------------------------------- */
  function workCard(work) {
    const concepts = (work.concepts || []).slice(0, 4).map((c) => c.display_name);
    const authors = (work.authorships || []).slice(0, 5).map((auth) => {
      const name = auth.author?.display_name || "Unknown";
      const id = auth.author?.id;
      return id
        ? `<a class="author-link" href="${authorHref(id)}">${esc(name)}</a>`
        : esc(name);
    });
    const moreAuthors = (work.authorships || []).length > 5 ? " et al." : "";
    const source = work.primary_location?.source?.display_name || "";
    const year = work.publication_year || "—";
    const doi = work.doi || work.id;
    const isOa = work.open_access?.is_oa;

    return el("article", { class: "card" }, [
      el("h3", { class: "card-title" }, [
        el("a", { href: doi, target: "_blank", rel: "noopener" }, esc(work.display_name || work.title || "Untitled")),
      ]),
      el("p", { class: "card-meta", html: `${esc(source)} · ${year} · cited ${fmt(work.cited_by_count)} ×` }),
      el("p", { class: "card-authors", html: authors.join(", ") + moreAuthors }),
      el("div", { class: "chips" }, [
        ...concepts.map((c) => el("span", { class: "chip" }, esc(c))),
        isOa ? el("span", { class: "chip oa" }, "Open Access") : null,
      ]),
    ]);
  }

  /* ---------------------------------------------------------------------
   * Author (researcher) card
   * ------------------------------------------------------------------- */
  function authorCard(author) {
    const concepts = (author.x_concepts || author.concepts || []).slice(0, 4).map((c) => c.display_name);
    const affil = author.last_known_institutions?.[0]?.display_name || "";

    return el("article", { class: "card" }, [
      el("h3", { class: "card-title" }, [
        el("a", { href: authorHref(author.id) }, esc(author.display_name || "Unknown")),
      ]),
      affil ? el("p", { class: "card-meta" }, esc(affil)) : null,
      el("p", { class: "card-meta", html: `${fmt(author.works_count)} works · ${fmt(author.cited_by_count)} citations` }),
      concepts.length
        ? el("div", { class: "chips" }, concepts.map((c) => el("span", { class: "chip" }, esc(c))))
        : null,
    ]);
  }

  /* ---------------------------------------------------------------------
   * Author profile (full view)
   * ------------------------------------------------------------------- */
  function authorProfile(author) {
    const concepts = (author.x_concepts || author.concepts || []).slice(0, 10);
    const affil = author.last_known_institutions?.[0]?.display_name || "Independent";
    const orcid = author.orcid;

    const stats = el("div", { class: "profile-stats" }, [
      statCard(fmt(author.works_count), "Works"),
      statCard(fmt(author.cited_by_count), "Citations"),
      statCard(author.h_index != null ? author.h_index : "—", "H-index"),
      statCard(author.works_count ? fmt(Math.round((author.cited_by_count || 0) / author.works_count)) : "—", "Avg cites/work"),
    ]);

    const chips = concepts.length
      ? el("div", { class: "chips" }, concepts.map((c) => el("span", { class: "chip" }, esc(c.display_name))))
      : el("p", { class: "card-meta" }, "No topic data available.");

    return el("div", { class: "profile-card" }, [
      el("h1", { class: "profile-name" }, esc(author.display_name || "Unknown researcher")),
      el("p", { class: "profile-affil" }, [
        esc(affil),
        orcid ? el("a", { href: orcid, target: "_blank", rel: "noopener", class: "author-link", style: "margin-left:8px" }, "ORCID ↗") : null,
      ]),
      stats,
      el("p", { class: "filter-label" }, "Research topics"),
      chips,
    ]);
  }

  function statCard(value, label) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat-value" }, esc(String(value))),
      el("div", { class: "stat-label" }, esc(label)),
    ]);
  }

  /* ---------------------------------------------------------------------
   * Similar researcher card with explanation
   * ------------------------------------------------------------------- */
  function similarCard({ candidate, score, shared }) {
    const affil = candidate.last_known_institutions?.[0]?.display_name || "";
    const sharedNames = shared.map((s) => s.name).slice(0, 4);
    const extra = shared.length > 4 ? ` +${shared.length - 4} more` : "";

    return el("article", { class: "card similar-card" }, [
      el("div", { class: "similar-header" }, [
        el("h3", { class: "similar-name" }, [
          el("a", { href: authorHref(candidate.id) }, esc(candidate.display_name || "Unknown")),
        ]),
        el("span", { class: "similar-score" }, `${Math.round(score * 100)}% match`),
      ]),
      affil ? el("p", { class: "card-meta" }, esc(affil)) : null,
      el("p", { class: "card-meta", html: `${fmt(candidate.works_count)} works · ${fmt(candidate.cited_by_count)} citations` }),
      el("p", { class: "explain-row", html: `<strong>Why:</strong> shared ${sharedNames.map(esc).join(", ")}${extra}` }),
    ]);
  }

  /* ---------------------------------------------------------------------
   * Toast
   * ------------------------------------------------------------------- */
  let toastTimer = null;
  function toast(message, duration = 3000) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, duration);
  }

  /* ---------------------------------------------------------------------
   * Loading / empty / pagination
   * ------------------------------------------------------------------- */
  function loading(message = "Searching…") {
    return el("div", { class: "loading" }, esc(message));
  }

  function empty(message = "No results found.") {
    return el("div", { class: "empty-state" }, [
      el("div", { class: "empty-icon" }, "🔍"),
      el("h3" }, "Nothing here"),
      el("p" }, esc(message)),
    ]);
  }

  function pagination({ page, totalPages, onPrev, onNext }) {
    const prev = el("button", { class: "btn btn-outline btn-sm", on: { click: onPrev } }, "← Prev");
    const next = el("button", { class: "btn btn-outline btn-sm", on: { click: onNext } }, "Next →");
    const label = el("span", { class: "card-meta", style: "align-self:center" }, `Page ${page} of ${totalPages || 1}`);
    return el("div", { class: "pagination" }, [prev, label, next]);
  }

  return {
    esc,
    el,
    fmt,
    shortId,
    authorHref,
    workCard,
    authorCard,
    authorProfile,
    similarCard,
    toast,
    loading,
    empty,
    pagination,
  };
})();

window.UI = UI;
