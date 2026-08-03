import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

let serviceAccount;

// 1. Render / Production Environment Variable check karein
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("🔥 [FIREBASE] Loaded credentials from Environment Variable.");
  } catch (parseError) {
    console.error("❌ [FIREBASE ERROR] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", parseError.message);
  }
} else {
  // 2. Local Development path resolution
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const localKeyPath = path.resolve(__dirname, "../serviceAccountKey.json");

  if (existsSync(localKeyPath)) {
    serviceAccount = JSON.parse(readFileSync(localKeyPath, "utf8"));
    console.log("🔥 [FIREBASE] Loaded credentials from local serviceAccountKey.json.");
  } else {
    console.error("❌ [FIREBASE ERROR] No credentials found! Neither ENV var nor local file exists.");
  }
}

// Initialize Firebase App
const app = initializeApp({
  credential: cert(serviceAccount),
});

// Export auth module
export const auth = getAuth(app);