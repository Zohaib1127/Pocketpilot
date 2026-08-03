import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

// Load service account JSON safely
const serviceAccount = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);

// Initialize Firebase App
const app = initializeApp({
  credential: cert(serviceAccount),
});

// Export auth module directly
export const auth = getAuth(app);