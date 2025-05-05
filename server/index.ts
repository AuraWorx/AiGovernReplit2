import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./utils/logger";
import * as dotenv from 'dotenv';

// Load environment variables early
dotenv.config();

const app = express();
// Increase payload size limit for API requests if needed (e.g., for webhook data)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Log only API requests
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  try {
    // Register API routes and authentication middleware
    const server = await registerRoutes(app);

    // Global Error Handler - Must be defined AFTER all routes/middleware
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      log(`Unhandled Error on ${req.method} ${req.path}: ${err.message}`, 'error-handler');
      console.error("Error Stack:", err.stack); // Log the full stack trace

      const status = err.status || err.statusCode || 500;
      // Avoid sending detailed error messages in production
      const message = process.env.NODE_ENV === 'production' && status === 500
          ? "Internal Server Error"
          : err.message || "Internal Server Error";

      res.status(status).json({ message });
    });

    // No static file serving or Vite middleware needed here
    // Frontend is served by S3/CloudFront

    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0", // Listen on all network interfaces within the container
    }, () => {
      log(`API server listening on port ${port}`);
    });

  } catch (error) {
    log(`Failed to start server: ${error}`, 'startup-error');
    console.error("Startup Error Details:", error);
    process.exit(1); // Exit if server fails to start
  }
})();
