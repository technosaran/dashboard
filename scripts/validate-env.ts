/**
 * Environment Variables Validation Script.
 * Implements requirement 7.12: environment configuration validation before deployment or dev starts.
 */

import { URL } from "url";
import * as fs from "fs";
import * as path from "path";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const OPTIONAL_VARS = [
  { name: "REDIS_URL", description: "Redis connection URL for caching and rate limiting" },
  { name: "CRON_SECRET", description: "Authorization secret for API cron/sync endpoints" },
  { name: "NEXT_PUBLIC_SITE_URL", description: "Base URL of the application site" },
];

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  envFiles.forEach((file) => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const index = trimmed.indexOf("=");
        if (index > 0) {
          const key = trimmed.slice(0, index).trim();
          const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          // Only set if not already defined
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  });
}

function checkEnv() {
  loadEnvFiles();
  console.log("=== Environment Validation ===");
  let failed = false;

  // 1. Validate Required Variables
  REQUIRED_VARS.forEach((key) => {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      console.error(`[ERROR] Missing required environment variable: ${key}`);
      failed = true;
    } else {
      console.log(`[OK] Required variable verified: ${key}`);
      
      // Additional format checking
      if (key.includes("URL")) {
        try {
          new URL(value);
        } catch {
          console.error(`[ERROR] Variable ${key} must be a valid absolute URL. Current: "${value}"`);
          failed = true;
        }
      }
    }
  });

  // 2. Warn about Optional Variables
  OPTIONAL_VARS.forEach(({ name, description }) => {
    const value = process.env[name];
    if (!value || value.trim() === "") {
      console.warn(`[WARN] Missing optional variable: ${name} (${description})`);
    } else {
      console.log(`[OK] Optional variable verified: ${name}`);
    }
  });

  console.log("==============================");
  if (failed) {
    console.error("[FAIL] Environment validation failed. Please check your .env files.");
    process.exit(1);
  } else {
    console.log("[SUCCESS] Environment validation passed!");
  }
}

// Run checks
checkEnv();
