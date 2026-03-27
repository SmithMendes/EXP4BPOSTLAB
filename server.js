const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Persistent Storage ─────────────────────────────────────────
// On Vercel /tmp is writable; locally use project directory
const DATA_FILE = process.env.VERCEL
  ? "/tmp/movies.json"
  : path.join(__dirname, "movies.json");

const SEED_DATA = [
  { id: 1, title: "Inception", genre: "Sci-Fi", rating: 5, recommendation: "Yes" },
  { id: 2, title: "The Godfather", genre: "Crime", rating: 5, recommendation: "Yes" },
  { id: 3, title: "Toy Story", genre: "Animation", rating: 4, recommendation: "Yes" },
  { id: 4, title: "The Room", genre: "Drama", rating: 1, recommendation: "No" },
];

// Read movies from file on EVERY request (essential for Vercel cold starts)
function getMovies() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Read error:", e.message);
  }
  // First run — seed the file
  const data = JSON.parse(JSON.stringify(SEED_DATA));
  saveMovies(data);
  return data;
}

function saveMovies(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Write error:", e.message);
  }
}

function getNextId(movies) {
  return movies.length ? Math.max(...movies.map((m) => m.id)) + 1 : 1;
}

// ─── GET /movies ─────────────────────────────────────────────────
app.get("/movies", (req, res) => {
  const movies = getMovies();
  const { rating } = req.query;

  if (rating) {
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum)) {
      return res.status(400).json({ error: "Rating must be a number" });
    }
    return res.json(movies.filter((m) => m.rating === ratingNum));
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

  const movies = getMovies();
  const newMovie = { id: getNextId(movies), title, genre, rating, recommendation };
  movies.push(newMovie);
  saveMovies(movies);
  res.status(201).json(newMovie);
});

// ─── PATCH /movies/:id ──────────────────────────────────────────
app.patch("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const movies = getMovies();
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
  const movies = getMovies();
  const index = movies.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Movie not found" });
  }

  const deleted = movies.splice(index, 1);
  saveMovies(movies);
  res.json({ message: "Movie deleted", movie: deleted[0] });
});

// ─── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
