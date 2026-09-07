# Contributing to ResearchHub

Thanks for your interest! This project is intentionally simple — a static web
app with no build step. Contributions are welcome in these areas:

## Most valuable contributions

1. **Similarity engine improvements** (`js/similarity.js`)
   - Add coauthor overlap (fetch target's works, extract coauthor IDs)
   - Add shared-reference signal (Jaccard over `referenced_works`)
   - Add embedding-based similarity (interface is already isolated)
2. **More facets** (`js/openalex.js` + `js/app.js`)
   - Venue filter (resolve source names
