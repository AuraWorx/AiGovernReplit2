import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./utils/logger";

// Augment Express Request type to include user
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// --- Password Hashing/Comparison (Keep existing) ---
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false; // Invalid stored password format
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    // Ensure buffers have the same length before comparison
    if (hashedBuf.length !== suppliedBuf.length) {
      return false;
    }
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    log(`Error comparing passwords: ${error}`, 'auth-error');
    return false;
  }
}

// --- Auth Setup ---
export async function setupAuth(app: Express) {
  // --- Environment Variable Checks ---
  if (!process.env.SESSION_SECRET) {
    log("Warning: SESSION_SECRET environment variable is not set. Using default (INSECURE).", "auth-setup");
  }
  if (!process.env.REDIS_URL) {
    log("FATAL: REDIS_URL environment variable is not set for session store.", "auth-setup");
    throw new Error("REDIS_URL is required for session storage.");
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL; // Expected from env vars (CloudFront URL)

  if (isProduction && !frontendUrl) {
      log("Warning: FRONTEND_URL environment variable not set in production. CORS might be too permissive.", "auth-setup");
  }

  // --- Initialize Redis Client for Sessions ---
  log(`Initializing Redis client for sessions at ${process.env.REDIS_URL}`, "auth-setup");
  const redisClient = createClient({
    url: process.env.REDIS_URL,
    // Add TLS configuration if required for ElastiCache in production
    // socket: {
    //   tls: isProduction,
    //   rejectUnauthorized: false // Adjust if using self-signed certs (not recommended)
    // }
  });

  redisClient.on('error', (err) => log(`Redis Session Client Error: ${err}`, 'redis-session-error'));
  redisClient.on('connect', () => log('Connected to Redis for sessions', 'redis-session'));
  redisClient.on('reconnecting', () => log('Reconnecting to Redis for sessions', 'redis-session'));
  redisClient.on('ready', () => log('Redis client ready for sessions', 'redis-session'));

  try {
    await redisClient.connect();
    log("Successfully connected Redis client for sessions", "auth-setup");
  } catch (err) {
     log(`Failed to connect Redis client for sessions: ${err}`, "auth-setup-error");
     throw err; // Fail fast if Redis isn't available
  }

  // --- Initialize Redis Session Store ---
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: "sess:", // Namespace sessions in Redis
    ttl: 60 * 60 * 24, // Session TTL in seconds (1 day), matches cookie maxAge
  });

  // --- Session Configuration ---
  const sessionSettings: session.SessionOptions = {
    store: redisStore,
    secret: process.env.SESSION_SECRET || "ai-govern-insecure-default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day (milliseconds)
      httpOnly: true,
      secure: isProduction, // Only set secure flag in production (requires HTTPS)
      sameSite: 'lax', // Good default for preventing CSRF
    }
  };

  // Trust proxy in production (e.g., ALB) for secure cookies and IP identification
  if (isProduction) {
       app.set("trust proxy", 1); // Adjust if more proxies are in front
  }

  app.use(session(sessionSettings));

  // --- Passport Initialization ---
  app.use(passport.initialize());
  app.use(passport.session());

  // --- CORS Middleware ---
  app.use((req, res, next) => {
    // Apply CORS only to API routes
    if (req.path.startsWith('/api')) {
      // Determine allowed origin
      const allowedOrigin = isProduction ? frontendUrl : (req.headers.origin || '*');

      // Check if frontendUrl is set in production before allowing
      const originToSend = (isProduction && !frontendUrl) ? '*' : allowedOrigin;

      if (isProduction && !frontendUrl && req.headers.origin) {
          log(`Warning: Allowing dynamic origin ${req.headers.origin} in production due to missing FRONTEND_URL`, 'cors-warning');
      }

      res.header('Access-Control-Allow-Origin', originToSend);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'); // Added Cache-Control
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      // Respond appropriately to preflight requests
      return res.sendStatus(204); // No Content
    }

    next();
  });


  // --- Passport Local Strategy ---
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user); // Pass the full user object
      } catch (error) {
        log(`Error during authentication for user ${username}: ${error}`, 'auth-error');
        return done(error);
      }
    }),
  );

  // --- Passport Serialization/Deserialization ---
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      // If user not found, pass null instead of undefined for consistency
      done(null, user || null);
    } catch (error) {
      log(`Error deserializing user ${id}: ${error}`, 'auth-error');
      done(error);
    }
  });

  // --- Authentication Routes ---

  // Helper to omit password from user object
  const sanitizeUser = (user: SelectUser) => {
      const { password, ...safeUser } = user;
      return safeUser;
  };

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, fullName, tenantId } = req.body;

      // Basic validation
      if (!username || !password || !email || !fullName) {
        return res.status(400).json({ message: "Username, password, email, and full name are required" });
      }
      if (password.length < 8) {
           return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Check for existing user/email
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" }); // 409 Conflict
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists" }); // 409 Conflict
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        fullName,
        tenantId: tenantId || 1, // Consider making tenantId mandatory or having a default tenant lookup
        role: "user", // Default role
      });

      // Log the user in after registration
      req.login(user, (err) => {
        if (err) {
          log(`Error logging in user ${user.username} after registration: ${err}`, 'auth-error');
          return next(err);
        }
        log(`User ${user.username} registered and logged in successfully`, 'auth');
        return res.status(201).json(sanitizeUser(user));
      });
    } catch (error) {
      log(`Error during registration: ${error}`, 'auth-error');
      next(error); // Pass to global error handler
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false | null, info?: { message: string }) => {
      if (err) {
        log(`Authentication error: ${err}`, 'auth-error');
        return next(err);
      }
      if (!user) {
        log(`Authentication failed: ${info?.message || 'No user object returned'}`, 'auth-failure');
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }

      // Manually establish the session
      req.login(user, (loginErr) => {
        if (loginErr) {
          log(`Error establishing session for user ${user.username}: ${loginErr}`, 'auth-error');
          return next(loginErr);
        }
        log(`User ${user.username} logged in successfully`, 'auth');
        return res.status(200).json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const username = req.user?.username || 'unknown user';
    req.logout((err) => {
      if (err) {
        log(`Error logging out user ${username}: ${err}`, 'auth-error');
        return next(err);
      }
      // Destroy the session after logout
      req.session.destroy((destroyErr) => {
         if (destroyErr) {
              log(`Error destroying session during logout for ${username}: ${destroyErr}`, 'auth-error');
              // Still proceed to clear cookie and send response
         }
         res.clearCookie('connect.sid', { path: '/' }); // Ensure path matches cookie setting
         log(`User ${username} logged out successfully`, 'auth');
         res.status(200).json({ message: "Logout successful" }); // Send JSON response
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(sanitizeUser(req.user));
  });

  log("Authentication setup complete using Redis sessions.", "auth-setup");
}
