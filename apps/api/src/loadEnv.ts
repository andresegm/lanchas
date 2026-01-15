// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { config } from "dotenv";
import { resolve } from "node:path";

// Local dev convenience:
// - Prefer repo root .env (pnpm runs apps/api with cwd at apps/api)
// - Also allow apps/api/.env override if present
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

