/**
 * Pure JavaScript text embeddings using feature hashing (no native modules required).
 *
 * Uses the "hashing trick" (feature hashing) to map text into a fixed-dimensional
 * vector space. Words and bigrams are hashed into 384 dimensions, then L2-normalized.
 *
 * This technique is well-established for text retrieval and works reliably for
 * support content where specific terminology (e.g. "password reset", "billing error")
 * needs to be matched semantically.
 *
 * Advantages:
 *  - Zero dependencies, no network calls, no native modules
 *  - Deterministic and fast (O(n) in text length)
 *  - Consistent: same text always produces the same vector
 *
 * Limitation vs neural embeddings:
 *  - No cross-word semantics (e.g. "broken" won't match "crashed")
 *  - Works best when query terms appear verbatim in documents
 */

const EMBEDDING_DIM = 384;

/**
 * FNV-1a 32-bit hash — fast, well-distributed, pure JS.
 */
function fnv1a(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    // FNV prime multiply (keep 32-bit unsigned)
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Map a string to a bucket index in [0, EMBEDDING_DIM).
 * The sign flip uses a second hash to reduce collision bias.
 */
function hashFeature(token: string): [number, number] {
  const h = fnv1a(token);
  const bucket = h % EMBEDDING_DIM;
  // Second hash to determine sign (reduces systematic cancellation)
  const sign = (fnv1a(token + "_sign") & 1) === 0 ? 1 : -1;
  return [bucket, sign];
}

/**
 * Tokenize text into words (lowercase, split on non-alphanumeric).
 * Removes common English stop-words to improve retrieval quality.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "not", "no", "so", "if",
  "it", "its", "this", "that", "they", "them", "their", "we", "our",
  "you", "your", "he", "she", "his", "her", "i", "my", "me", "us",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? [])
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Generate a 384-dimensional embedding for the given text.
 *
 * Features used:
 *  - Unigrams (weight 1.0)
 *  - Bigrams (weight 0.7) — improves phrase matching
 *  - Trigrams (weight 0.4) — improves longer phrase matching
 *
 * Output is L2-normalized so cosine similarity = dot product.
 */
export async function embed(text: string): Promise<number[]> {
  // Truncate to keep computation bounded
  const tokens = tokenize(text.slice(0, 8192));
  const vec = new Float64Array(EMBEDDING_DIM);

  for (let i = 0; i < tokens.length; i++) {
    // Unigram
    const [bi, si] = hashFeature(tokens[i]);
    vec[bi] += si * 1.0;

    // Bigram
    if (i + 1 < tokens.length) {
      const [bb, sb] = hashFeature(`${tokens[i]}__${tokens[i + 1]}`);
      vec[bb] += sb * 0.7;
    }

    // Trigram
    if (i + 2 < tokens.length) {
      const [bt, st] = hashFeature(`${tokens[i]}__${tokens[i + 1]}__${tokens[i + 2]}`);
      vec[bt] += st * 0.4;
    }
  }

  // L2 normalize so cosine similarity = dot product
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) + 1e-10;

  return Array.from(vec).map((v) => v / norm);
}

/**
 * Cosine similarity between two vectors (for scoring outside pgvector).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}
