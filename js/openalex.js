/**
 * OpenAlex REST API client.
 *
 * OpenAlex is a free CC0 scholarly index. No API key required.
 * Polite pool: ~10 requests/second — enforced via a simple queue.
 * Docs: https://docs.openalex.org/api/
 */
const OpenAlexClient = (() => {
  const BASE = "https://api.openalex.org";

  // Minimal rate limiter: space requests by at least 120 ms.
  let lastRequestTime = 0;
  const MIN_INTERVAL_MS = 120;

  async function throttle() {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestTime = Date.now();
  }

  /**
   * Perform a GET request with a timeout and JSON parsing.
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async function getJSON(url) {
    await throttle();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`OpenAlex request failed (${res.status})`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Search scholarly works.
   * @param {Object} params
   * @param {string} params.query          Free-text query
   * @param {Object} [params.filters]      OpenAlex filter expressions
   * @param {string} [params.sort]         Sort expression
   * @param {number} [params.page=1]
   * @param {number} [params.perPage=20]
   */
  async function searchWorks({ query, filters = {}, sort, page = 1, perPage = 20 }) {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (sort) params.set("sort", sort);
    params.set("per-page", String(perPage));
    params.set("page", String(page));

    const filterExprs = [];
    if (filters.yearFrom || filters.yearTo) {
      const from = filters.yearFrom || 1900;
      const to = filters.yearTo || new Date().getFullYear();
      filterExprs.push(`publication_year:${from}-${to}`);
    }
    if (filters.oa) filterExprs.push("open_access.is_oa:true");
    if (filters.conceptId) filterExprs.push(`concepts.id:${filters.conceptId}`);
    if (filterExprs.length) params.set("filter", filterExprs.join(","));

    return getJSON(`${BASE}/works?${params.toString()}`);
  }

  /**
   * Search authors (researchers).
   */
  async function searchAuthors({ query, page = 1, perPage = 20 }) {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    params.set("per-page", String(perPage));
    params.set("page", String(page));
    return getJSON(`${BASE}/authors?${params.toString()}`);
  }

  /**
   * Fetch a single author by OpenAlex ID (e.g. "A5023888391").
   */
  async function getAuthor(id) {
    const cleanId = id.includes("openalex.org") ? id.split("/").pop() : id;
    return getJSON(`${BASE}/authors/${cleanId}`);
  }

  /**
   * Fetch an author's works (capped for API politeness).
   */
  async function getAuthorWorks(authorId, { perPage = 10 } = {}) {
    const cleanId = authorId.includes("openalex.org") ? authorId.split("/").pop() : authorId;
    const params = new URLSearchParams();
    params.set("filter", `author.id:${cleanId}`);
    params.set("sort", "cited_by_count:desc");
    params.set("per-page", String(perPage));
    return getJSON(`${BASE}/works?${params.toString()}`);
  }

  /**
   * Find authors working on a given concept (topic).
   * Used as the candidate pool for similar-researcher matching.
   */
  async function getAuthorsByConcept(conceptId, { perPage = 25 } = {}) {
    const params = new URLSearchParams();
    params.set("filter", `x_concepts.id:${conceptId}`);
    params.set("per-page", String(perPage));
    return getJSON(`${BASE}/authors?${params.toString()}`);
  }

  /**
   * Search concepts by name — used to resolve a typed topic into an ID.
   */
  async function searchConcepts(query, { perPage = 5 } = {}) {
    const params = new URLSearchParams();
    params.set("search", query);
    params.set("per-page", String(perPage));
    return getJSON(`${BASE}/concepts?${params.toString()}`);
  }

  return {
    searchWorks,
    searchAuthors,
    getAuthor,
    getAuthorWorks,
    getAuthorsByConcept,
    searchConcepts,
  };
})();

// Expose for the other modules (loaded in order via <script> tags).
window.OpenAlexClient = OpenAlexClient;
