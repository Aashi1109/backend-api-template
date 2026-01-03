import { Router } from "express";
import { readdirSync } from "fs";
import { logger } from "@/shared";

const router: Router = Router();

// Get the v1 directory path (__dirname is available in CommonJS)
const v1Dir = __dirname;

// Read all files in the v1 directory
const files = readdirSync(v1Dir);

// Filter and import all route files
const routeFiles = files.filter(
  (file) => file.endsWith(".route.ts") || file.endsWith(".route.js")
);

// Import and register all routes
for (const file of routeFiles) {
  // Skip index.ts itself
  if (file === "index.ts" || file === "index.js") {
    continue;
  }

  // Remove extension and get the route name
  const routeName = file.replace(/\.route\.(ts|js)$/, "");

  // Dynamic import - works in both dev (tsx) and production (compiled)
  // Use relative path for require (remove .ts extension for require)
  const routePath = `./${file.replace(/\.ts$/, "").replace(/\.js$/, "")}`;
  const routeModule = require(routePath);
  const routeRouter = routeModule.default || routeModule;

  // Mount the router at /{routeName}
  router.use(`/${routeName}`, routeRouter);
  logger.info(`Route loaded: /v1/${routeName} from ${file}`);
}

export default router;
