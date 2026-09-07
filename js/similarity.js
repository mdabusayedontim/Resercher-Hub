/**
 * SimilarityEngine — "find similar researchers" algorithm.
 *
 * MVP implementation: Jaccard similarity over shared research concepts
 * (topics). Deliberately simple: no embeddings, no GPU, no database.
 * The module is isolated behind the `score` / `findSimilar` interface so a
 * vector/embedding implementation can be swapped in later without touching
 * the UI.
 *
 * Future signals (documented for contributors):
 *   - coauthor overlap
 *   - shared references / citation-graph
 *   - LLM/embedding-based semantic similarity
 */
const SimilarityEngine = (() => {
  /**
   * Jaccard similarity between two sets (arrays).
   * J(A,B) = |A ∩ B| / |A ∪ B|. Returns 0 if both empty.
   */
  function jaccard(setA, setB) {
    const a = new Set(setA);
    const b = new Set(setB);
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection++;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Extract concept IDs from an OpenAlex author object.
   * Handles both `x_concepts` (score 0-100) and legacy `concepts` (0-1).
   */
  function conceptIds(author) {
    const src = author.x_concepts || author.concepts || [];
    return src.map((c) => c.id).filter(Boolean);
  }

  /**
   * Extract concept display names + scores (for explanations).
   */
  function conceptLabels(author) {
    const src = author.x_concepts || author.concepts || [];
    return src.map((c) => ({
      id: c.id,
      name: c.display_name,
      score: c.score,
    }));
  }

  /**
   * Score a candidate author against a target author.
   * @returns {{score:number, shared:Array<{id:string,name:string}>}}
   */
  function score(target, candidate) {
    const targetIds = conceptIds(target);
    const candidateIds = conceptIds(candidate);
    const candidateLabels = conceptLabels(candidate);

    const sharedIds = new Set(targetIds.filter((id) => candidateIds.includes(id)));
    const shared = candidateLabels.filter((c) => sharedIds.has(c.id));

    const sim = jaccard(targetIds, candidateIds);

    // Institution bonus: +0.08 if they share a last-known institution.
    let bonus = 0;
    const targetInst = (target.last_known_institutions || []).map((i) => i.id);
    const candInst = (candidate.last_known_institutions || []).map((i) => i.id);
    if (targetInst.some((id) => candInst.includes(id))) bonus = 0.08;

    return {
      score: Math.min(1, sim + bonus),
      shared,
    };
  }

  /**
   * Find researchers similar to the target author.
   *
   * Strategy: use the target's top concept as the candidate pool, score
   * every candidate with Jaccard over all concepts, rank, exclude self.
   *
   * @param {Object} targetAuthor  Full OpenAlex author object
   * @param {Object} client        OpenAlexClient instance
   * @param {number} [limit=10]
   */
  async function findSimilar(targetAuthor, client, limit = 10) {
    const concepts = conceptLabels(targetAuthor).sort((a, b) => b.score - a.score);
    if (concepts.length === 0) return [];

    const topConcept = concepts[0];
    let candidates = [];

    // Gather candidates from the top few concepts for a wider pool.
    for (const concept of concepts.slice(0, 3)) {
      try {
        const res = await client.getAuthorsByConcept(concept.id, { perPage: 25 });
        candidates = candidates.concat(res.results || []);
      } catch (_) {
        // Concept query failed — continue with whatever we have.
      }
    }

    // De-duplicate by author id.
    const seen = new Map();
    for (const c of candidates) {
      if (c.id !== targetAuthor.id) seen.set(c.id, c);
    }

    const scored = [];
    for (const candidate of seen.values()) {
      const { score: s, shared } = score(targetAuthor, candidate);
      if (s > 0.05 && shared.length > 0) {
        scored.push({ candidate, score: s, shared });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  return {
    jaccard,
    score,
    findSimilar,
  };
})();

window.SimilarityEngine = SimilarityEngine;
