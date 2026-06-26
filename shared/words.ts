// Common English words used to generate typing tests. Kept intentionally simple
// (lowercase, no punctuation) for the classic Monkeytype "words" feel.
export const WORDS: string[] = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is",
  "find", "here", "thing", "great", "man", "world", "life", "still", "hand", "high",
  "such", "place", "case", "part", "where", "much", "before", "right", "through", "again",
  "off", "down", "while", "should", "those", "both", "between", "under", "never", "same",
  "another", "around", "however", "home", "small", "large", "next", "early", "young", "few",
  "house", "point", "play", "move", "live", "believe", "hold", "bring", "happen", "must",
  "water", "without", "second", "since", "during", "school", "begin", "keep", "open", "seem",
  "together", "best", "side", "turn", "every", "start", "might", "always", "often", "really",
  "almost", "above", "across", "below", "behind", "enough", "follow", "story", "course", "money",
  "company", "system", "program", "question", "government", "number", "night", "water", "room", "mother",
  "area", "money", "study", "book", "eye", "job", "word", "business", "issue", "kind",
  "head", "father", "power", "game", "line", "end", "member", "law", "car", "city",
  "name", "team", "minute", "idea", "body", "information", "back", "parent", "face", "others",
  "level", "office", "door", "health", "person", "art", "war", "history", "party", "result",
  "change", "morning", "reason", "research", "girl", "guy", "moment", "air", "teacher", "force",
  "education", "foot", "boy", "age", "policy", "process", "music", "market", "sense", "nation",
  "plan", "college", "interest", "death", "experience", "effect", "use", "class", "control", "care",
  "field", "development", "role", "effort", "rate", "heart", "drug", "show", "leader", "light",
  "voice", "wife", "police", "mind", "price", "report", "decision", "son", "view", "love",
  "table", "value", "summer", "letter", "model", "season", "stage", "page", "spring", "color",
  "green", "blue", "river", "fire", "value", "mountain", "ocean", "forest", "garden", "window",
];

export type WordsLanguage = "english";

/** Returns `count` random words from the list (with repetition allowed). */
export function generateWords(count: number, seed?: number): string[] {
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const out: string[] = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    let idx = Math.floor(rng() * WORDS.length);
    // avoid the same word twice in a row for a nicer feel
    if (idx === prev) idx = (idx + 1) % WORDS.length;
    prev = idx;
    out.push(WORDS[idx]);
  }
  return out;
}

/** Convenience: a single space-joined string of `count` words. */
export function generateText(count: number, seed?: number): string {
  return generateWords(count, seed).join(" ");
}

// Deterministic PRNG so a race can share the same text across clients via a seed.
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
