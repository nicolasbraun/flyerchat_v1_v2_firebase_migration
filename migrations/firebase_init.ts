import {
  initializeApp,
  cert,
  ServiceAccount,
  getApps,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { readJSONFromFile } from "../../utils/filepath_utils";

/**
 * Initialize Firebase Admin SDK
 * @param useEmulator - Whether to use the emulator
 * @returns The Firestore instance
 */
export async function initializeFirebase(
  useEmulator = false
): Promise<Firestore> {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    if (useEmulator) {
      console.log("Initializing Firebase with emulator");
      // Initialize with emulator configuration
      initializeApp({
        projectId: "mood-app-42",
      });
    } else {
      console.log("Initializing Firebase with service account");
      // Initialize with service account
      const serviceAccountJSON = await readJSONFromFile<ServiceAccount>(
        "../../../../secrets/serviceAccountKeyDev.json"
      );

      if (!serviceAccountJSON) {
        throw new Error("Failed to load service account configuration");
      }

      initializeApp({
        credential: cert(serviceAccountJSON),
      });
    }
  }

  const db = getFirestore();
  if (useEmulator) {
    db.settings({
      host: "localhost:8080",
      ssl: false,
    });
  }
  return db;
}
