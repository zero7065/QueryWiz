/**
 * Root full-stack Express server + Vite integration
 * Handles both the API endpoints and asset serving for client production/development.
 */
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDatabase } from "./server/lib/db.ts";
import queryRouter from "./server/routes/query.ts";

async function runServer() {
  const app = express();
  const PORT = 3000;

  console.log("[QueryWiz Server] Booting fullstack environment...");

  // 1. Initialize DB + Seeding
  try {
    await initDatabase();
  } catch (err) {
    console.error("[QueryWiz Server] Database initialization crashed:", err);
  }

  // 2. Setup parsing middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. Mount Backend API Routes FIRST
  app.use("/api/query", queryRouter);

  // Stats alias forwarder
  app.get("/api/stats", (req, res, next) => {
    req.url = "/stats";
    queryRouter(req, res, next);
  });

  // Healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  // 4. Setup Vite Dev middleware or Static Production serving
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    console.log("[QueryWiz Server] Mounting Vite dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[QueryWiz Server] Running in production. Serving static files from ./dist...");
    const distPath = path.resolve(process.cwd(), "dist");
    
    // Serve static frontend assets
    app.use(express.static(distPath));
    
    // Single page application wildcard fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 5. Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🚀 QueryWiz is running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${isProd ? "Production" : "Development"}`);
    console.log(`======================================================\n`);
  });
}

runServer().catch((err) => {
  console.error("[QueryWiz Server] Fatal start failure:", err);
});
