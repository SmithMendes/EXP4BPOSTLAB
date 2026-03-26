const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory movie storage with some seed data
let movies = [
  { id: 1, title: "Inception", genre: "Sci-Fi", rating: 5, recommendation: "Yes" },
  { id: 2, title: "The Godfather", genre: "Crime", rating: 5, recommendation: "Yes" },
  { id: 3, title: "Toy Story", genre: "Animation", rating: 4, recommendation: "Yes" },
  { id: 4, title: "The Room", genre: "Drama", rating: 1, recommendation: "No" },
];
let nextId = 5;

// ─── GET /movies ─────────────────────────────────────────────────
// Returns all movies. Supports ?rating=N to filter by exact rating.
app.get("/movies", (req, res) => {
  const { rating } = req.query;

  if (rating) {
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum)) {
      return res.status(400).json({ error: "Rating must be a number" });
    }
    const filtered = movies.filter((m) => m.rating === ratingNum);
    return res.json(filtered);
  }

  res.json(movies);
});

// ─── POST /movies ────────────────────────────────────────────────
// Creates a new movie. Body must include title, genre, rating, recommendation.
app.post("/movies", (req, res) => {
  const { title, genre, rating, recommendation } = req.body;

  if (!title || !genre || rating === undefined || !recommendation) {
    return res.status(400).json({
      error: "All fields are required: title, genre, rating, recommendation",
    });
  }

  const newMovie = { id: nextId++, title, genre, rating, recommendation };
  movies.push(newMovie);
  res.status(201).json(newMovie);
});

// ─── PATCH /movies/:id ──────────────────────────────────────────
// Partially updates a movie by id.
app.patch("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const movie = movies.find((m) => m.id === id);

  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  const { title, genre, rating, recommendation } = req.body;
  if (title !== undefined) movie.title = title;
  if (genre !== undefined) movie.genre = genre;
  if (rating !== undefined) movie.rating = rating;
  if (recommendation !== undefined) movie.recommendation = recommendation;

  res.json(movie);
});

// ─── DELETE /movies/:id ─────────────────────────────────────────
// Deletes a movie by id.
app.delete("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = movies.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Movie not found" });
  }

  const deleted = movies.splice(index, 1);
  res.json({ message: "Movie deleted", movie: deleted[0] });
});

// ─── Poster Proxy (Wikipedia REST API — free, no key needed) ────
const https = require("https");

function wikiGet(slug) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
    const opts = { headers: { 'User-Agent': 'CineVault/1.0 (student project)' } };
    https.get(url, opts, (resp) => {
      // Handle redirects
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        https.get(resp.headers.location, opts, (resp2) => {
          let d = ""; resp2.on("data", c => d += c);
          resp2.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        }).on("error", () => resolve(null));
        return;
      }
      let data = "";
      resp.on("data", (chunk) => (data += chunk));
      resp.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

async function fetchPoster(title) {
  // Try "Title_(film)" first, then just "Title"
  for (const slug of [`${title}_(film)`, title]) {
    const json = await wikiGet(slug);
    if (json && json.thumbnail && json.thumbnail.source) {
      // Request a larger image (replace width in URL)
      return json.thumbnail.source.replace(/\/\d+px-/, '/500px-');
    }
  }
  return null;
}

app.get("/api/poster", async (req, res) => {
  const title = req.query.title;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const poster = await fetchPoster(title);
  res.json({ poster });
});

// ─── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
