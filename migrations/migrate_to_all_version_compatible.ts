import { Firestore, DocumentSnapshot } from "firebase-admin/firestore";
import {
  toAllVersionsCompatible,
  v2migrationFlag,
} from "../../functions/src/chat_messages/chat_messages_mappers";
import * as constants from "../../functions/src/constants";

const BATCH_SIZE = 500;

/**
 * Migrates all messages to be compatible with both V1 and V2 formats
 */
export async function migrateToAllVersionsCompatible(
  db: Firestore
): Promise<void> {
  try {
    let updatedCount = 0;
    let leastCreatedAt: Date | null = null;

    do {
      // Query all messages across all rooms that haven't been migrated
      let query = db
        .collectionGroup(constants.collectionsKeys.chatMessagesCollection)
        .orderBy("createdAt", "asc")
        .limit(BATCH_SIZE);

      if (leastCreatedAt) {
        query = query.startAfter(leastCreatedAt);
        console.log(`Continuing from createdAt: ${leastCreatedAt}`);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        console.log("No more messages to process.");
        break;
      }

      const batch = db.batch();
      let pageCount = 0;

      for (const doc of snapshot.docs) {
        const messageData = doc.data();

        // Skip if already migrated
        if (messageData[v2migrationFlag] === true) {
          continue;
        }
        const allVersionsMessage = toAllVersionsCompatible(messageData);

        // Extract roomId from the document path (rooms/{roomId}/messages/{messageId})
        const pathParts = doc.ref.path.split("/");
        const roomId = pathParts[1];

        // Update the original document
        const messageRef = db
          .collection(constants.collectionsKeys.roomsCollection)
          .doc(roomId)
          .collection(constants.collectionsKeys.chatMessagesCollection)
          .doc(doc.id);
        batch.update(messageRef, allVersionsMessage);
        pageCount++;
        updatedCount++;
      }

      // Commit the entire page
      await batch.commit();
      console.log(`Committed page of ${pageCount} messages`);

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      leastCreatedAt = lastDoc.data().createdAt.toDate();
      console.log(`Last processed document createdAt: ${leastCreatedAt}`);
    } while (leastCreatedAt);

    console.log(
      `Successfully migrated ${updatedCount} messages to all-versions compatible format`
    );
  } catch (error: any) {
    // Check if this is a missing index error
    if (error?.code === 9 && error?.message?.includes("FAILED_PRECONDITION")) {
      console.error(
        "Missing Firestore index error. You need to create a composite index for the collection group query.",
        {
          error: {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            details: error?.details,
          },
          requiredIndex: {
            collectionGroup: constants.collectionsKeys.chatMessagesCollection,
            fields: ["createdAt ASC"],
          },
          instructions:
            "Please create the required index in the Firebase Console or using the Firebase CLI.",
        }
      );
    } else {
      console.error("Error migrating messages:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        details: error?.details,
        status: error?.status,
        ...error,
      });
    }
    throw error;
  }
}
