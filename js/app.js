/**
 * ResearchHub application — router, state, and event binding.
 *
 * Hash routes:
 *   #/                    Search view (default)
 *   #/author/{OpenAlexID} Researcher profile + similar researchers
 */
const App = (() => {
  const state = {
    searchType: "works",
    query: "",
    filters: {
      yearFrom: null,
      yearTo: null,
      oa: false,
      topic: "",
      conceptId: null,
      sort: "relevance_score:desc",
    },
    page: 1,
    perPage: 20,
    totalPages: 1,
    // Cached resolved topic: { name, id }
    resolvedTopic: null,
  };

  /* ---------------------------------------------------------------------
   * DOM refs
   * ------------------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  const refs = {
    viewSearch: $("view-search"),
    viewAuthor: $("view-author"),
    searchForm: $("search-form"),
    searchType: $("search-type"),
    searchQuery: $("search-query"),
    filtersPanel: $("filters-panel"),
    filterYearFrom: $("filter-year-from"),
    filterYearTo: $("filter-year-to"),
    filterTopic: $("filter-topic"),
    filterTopicStatus: $("filter-topic-status"),
    filterOa: $("filter-oa"),
    filterSort: $("filter-sort"),
    filterClear: $("filter-clear"),
    resultsMeta: $("results-meta"),
    resultsGrid: $("results-grid"),
    pagination: $("pagination"),
    authorContent: $("author-content"),
    authorBack: $("author-back"),
  };

  /* ---------------------------------------------------------------------
   * Router
   * ------------------------------------------------------------------- */
  function parseHash() {
    const hash = window.location.hash || "#/";
    const parts = hash.replace(/^#\//, "").split("/");
    if (parts[0] === "author" && parts[1]) return { view: "author", id: parts[1] };
    return { view: "search" };
  }

  function showView(view) {
    refs.viewSearch.hidden = view !== "search";
    refs.viewAuthor.hidden = view !== "author";
  }

  /* ---------------------------------------------------------------------
   * Search view
   * ------------------------------------------------------------------- */
  function bindSearchEvents() {
    refs.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.query = refs.searchQuery.value.trim();
      state.searchType = refs.searchType.value;
      state.page = 1;
      runSearch();
    });

    refs.searchType.addEventListener("change", () => {
      state.searchType = refs.searchType.value;
      refs.searchQuery.placeholder =
        state.searchType === "works"
          ? "Search papers by title, keyword, or author…"
          : "Search researchers by name or topic…";
    });

    refs.filterClear.addEventListener("click", () => {
      state.filters = { ...state.filters, yearFrom: null, yearTo: null, oa: false, topic: "", conceptId: null };
      state.resolvedTopic = null;
      refs.filterYearFrom.value = "";
      refs.filterYearTo.value = "";
      refs.filterTopic.value = "";
      refs.filterTopicStatus.textContent = "";
      refs.filterOa.checked = false;
      state.page = 1;
      if (state.query) runSearch();
    });

    // Resolve typed topic -> OpenAlex concept ID (debounced).
    let topicTimer = null;
    refs.filterTopic.addEventListener("input", () => {
      clearTimeout(topicTimer);
      topicTimer = setTimeout(async () => {
        const value = refs.filterTopic.value.trim();
        if (!value) {
          state.filters.conceptId = null;
          state.filters.topic = "";
          state.resolvedTopic = null;
          refs.filterTopicStatus.textContent = "";
          return;
        }
        try {
          const res = await OpenAlexClient.searchConcepts(value, { perPage: 1 });
          if (res.results && res.results.length > 0) {
            const concept = res.results[0];
            state.filters.conceptId = concept.id.split("/").pop();
            state.filters.topic = concept.display_name;
            state.resolvedTopic = { name: concept.display_name, id: state.filters.conceptId };
            refs.filterTopicStatus.textContent = `✓ Topic: ${concept.display_name}`;
            if (state.query) { state.page = 1; runSearch(); }
          } else {
            state.filters.conceptId = null;
            refs.filterTopicStatus.textContent = "Topic not found";
          }
        } catch (_) {
          refs.filterTopicStatus.textContent = "Could not resolve topic";
        }
      }, 500);
    });

    refs.filterSort.addEventListener("change", () => {
      state.filters.sort = refs.filterSort.value;
      if (state.query) { state.page = 1; runSearch(); }
    });

    refs.filterOa.addEventListener("change", () => {
      state.filters.oa = refs.filterOa.checked;
      if (state.query) { state.page = 1; runSearch(); }
    });

    refs.filterYearFrom.addEventListener("change", () => {
      state.filters.yearFrom = refs.filterYearFrom.value ? parseInt(refs.filterYearFrom.value, 10) : null;
      if (state.query) { state.page = 1; runSearch(); }
    });

    refs.filterYearTo.addEventListener("change", () => {
      state.filters.yearTo = refs.filterYearTo.value ? parseInt(refs.filterYearTo.value, 10) : null;
      if (state.query) { state.page = 1; runSearch(); }
    });
  }

  async function runSearch() {
    if (!state.query) return;
    refs.resultsGrid.innerHTML = "";
    refs.resultsGrid.appendChild(UI.loading("Searching OpenAlex…"));
    refs.resultsMeta.textContent = "";
    refs.pagination.innerHTML = "";

    try {
      let data;
      if (state.searchType === "works") {
        data = await OpenAlexClient.searchWorks({
          query: state.query,
          filters: state.filters,
          sort: state.filters.sort,
          page: state.page,
          perPage: state.perPage,
        });
        renderWorks(data);
      } else {
        data = await OpenAlexClient.searchAuthors({
          query: state.query,
          page: state.page,
          perPage: state.perPage,
        });
        renderAuthors(data);
      }
    } catch (err) {
      refs.resultsGrid.innerHTML = "";
      refs.resultsGrid.appendChild(UI.empty(`Search failed: ${err.message}. Please try again.`));
    }
  }

  function renderWorks(data) {
    refs.resultsGrid.innerHTML = "";
    state.totalPages = Math.ceil((data.meta?.count || 0) / state.perPage);

    if (!data.results || data.results.length === 0) {
      refs.resultsGrid.appendChild(UI.empty("No papers matched your query. Try different keywords or clear filters."));
      return;
    }

    refs.resultsMeta.textContent = `${UI.fmt(data.meta?.count)} results`;
    data.results.forEach((work) => refs.resultsGrid.appendChild(UI.workCard(work)));
    renderPagination();
  }

  function renderAuthors(data) {
    refs.resultsGrid.innerHTML = "";
    state.totalPages = Math.ceil((data.meta?.count || 0) / state.perPage);

    if (!data.results || data.results.length === 0) {
      refs.resultsGrid.appendChild(UI.empty("No researchers matched your query. Try a different name or topic."));
      return;
    }

    refs.resultsMeta.textContent = `${UI.fmt(data.meta?.count)} researchers`;
    data.results.forEach((author) => refs.resultsGrid.appendChild(UI.authorCard(author)));
    renderPagination();
  }

  function renderPagination() {
    refs.pagination.innerHTML = "";
    if (state.totalPages <= 1) return;
    refs.pagination.appendChild(
      UI.pagination({
        page: state.page,
        totalPages: state.totalPages,
        onPrev: () => { if (state.page > 1) { state.page--; runSearch(); } },
        onNext: () => { if (state.page < state.totalPages) { state.page++; runSearch(); } },
      })
    );
  }

  /* ---------------------------------------------------------------------
   * Author view
   * ------------------------------------------------------------------- */
  async function renderAuthor(id) {
    refs.authorContent.innerHTML = "";
    refs.authorContent.appendChild(UI.loading("Loading researcher profile…"));

    try {
      const author = await OpenAlexClient.getAuthor(id);
      refs.authorContent.innerHTML = "";
      refs.authorContent.appendChild(UI.authorProfile(author));

      // Recent works
      const worksSection = UI.el("h2", { class: "section-title" }, "Recent influential works");
      refs.authorContent.appendChild(worksSection);
      const worksGrid = UI.el("div", { class: "results-grid" });
      refs.authorContent.appendChild(worksGrid);

      try {
        const worksRes = await OpenAlexClient.getAuthorWorks(author.id, { perPage: 5 });
        (worksRes.results || []).forEach((w) => worksGrid.appendChild(UI.workCard(w)));
      } catch (_) {
        worksGrid.appendChild(UI.empty("Could not load works."));
      }

      // Similar researchers
      const simSection = UI.el("h2", { class: "section-title" }, "Similar researchers");
      refs.authorContent.appendChild(simSection);
      const simGrid = UI.el("div", { class: "results-grid" });
      refs.authorContent.appendChild(simGrid);
      simGrid.appendChild(UI.loading("Finding similar researchers…"));

      try {
        const similar = await SimilarityEngine.findSimilar(author, OpenAlexClient, 10);
        simGrid.innerHTML = "";
        if (similar.length === 0) {
          simGrid.appendChild(UI.empty("No sufficiently similar researchers found yet."));
        } else {
          similar.forEach((s) => simGrid.appendChild(UI.similarCard(s)));
        }
      } catch (err) {
        simGrid.innerHTML = "";
        simGrid.appendChild(UI.empty(`Could not compute similarity: ${err.message}`));
      }
    } catch (err) {
      refs.authorContent.innerHTML = "";
      refs.authorContent.appendChild(UI.empty(`Researcher not found or API error (${err.message}).`));
    }
  }

  /* ---------------------------------------------------------------------
   * Router dispatch
   * ------------------------------------------------------------------- */
  function route() {
    const { view, id } = parseHash();
    showView(view);
    if (view === "author") {
      window.scrollTo({ top: 0 });
      renderAuthor(id);
    }
  }

  /* ---------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------- */
  function init() {
    bindSearchEvents();
    refs.authorBack.addEventListener("click", () => {
      window.location.hash = "#/";
    });
    window.addEventListener("hashchange", route);
    route();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
