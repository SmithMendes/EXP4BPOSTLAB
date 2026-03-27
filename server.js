const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Persistent JSON Storage ────────────────────────────────────
// On Vercel, __dirname is read-only but /tmp is writable
const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "movies.json")
  : path.join(__dirname, "movies.json");

const SEED_DATA = [
  { id: 1, title: "Inception", genre: "Sci-Fi", rating: 5, recommendation: "Yes" },
  { id: 2, title: "The Godfather", genre: "Crime", rating: 5, recommendation: "Yes" },
  { id: 3, title: "The Room", genre: "Drama", rating: 1, recommendation: "No" },
];

function loadMovies() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading movies.json, using seed data:", err.message);
  }
  // First run — seed the file
  saveMovies(SEED_DATA);
  return [...SEED_DATA];
}

function saveMovies(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Vercel has a read-only filesystem — data stays in-memory for the session
    console.warn("Could not write movies.json (read-only filesystem)");
  }
}

let movies = loadMovies();
let nextId = movies.length ? Math.max(...movies.map((m) => m.id)) + 1 : 1;

// ─── GET /movies ─────────────────────────────────────────────────
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
app.post("/movies", (req, res) => {
  const { title, genre, rating, recommendation } = req.body;

  if (!title || !genre || rating === undefined || !recommendation) {
    return res.status(400).json({
      error: "All fields are required: title, genre, rating, recommendation",
    });
  }

  const newMovie = { id: nextId++, title, genre, rating, recommendation };
  movies.push(newMovie);
  saveMovies(movies);
  res.status(201).json(newMovie);
});

// ─── PATCH /movies/:id ──────────────────────────────────────────
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

  saveMovies(movies);
  res.json(movie);
});

// ─── DELETE /movies/:id ─────────────────────────────────────────
app.delete("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = movies.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Movie not found" });
  }

  const deleted = movies.splice(index, 1);
  saveMovies(movies);
  res.json({ message: "Movie deleted", movie: deleted[0] });
});

// ─── Poster Proxy (OMDB API) ───────────────────────────────────
const OMDB_KEY = "7840f265";

function omdbGet(title) {
  return new Promise((resolve) => {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`;
    https.get(url, (resp) => {
      let data = "";
      resp.on("data", (chunk) => (data += chunk));
      resp.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

app.get("/api/poster", async (req, res) => {
  const title = req.query.title;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const json = await omdbGet(title);
  const poster = json && json.Poster && json.Poster !== "N/A" ? json.Poster : null;
  res.json({ poster });
});

// ─── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
