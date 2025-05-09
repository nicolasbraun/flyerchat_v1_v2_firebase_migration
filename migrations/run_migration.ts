import { migrateToAllVersionsCompatible } from "./20250507_flyerchatv2_to_all_version_compatible";
// import { duplicateToV2Collection } from "./20250507_flyerchatv2_copy_to_new_collection";
import { initializeFirebase } from "./utils/firebase_init";
import { Firestore } from "firebase-admin/firestore";

const useEmulator = true;

async function runMigration(): Promise<void> {
  try {
    const db: Firestore = await initializeFirebase(useEmulator);
    await migrateToAllVersionsCompatible(db);
    // await duplicateToV2Collection(db);
    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
