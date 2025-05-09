import { Firestore } from "firebase-admin/firestore";
import {
  convertV1ToV2,
  v2migrationFlag,
} from "../../functions/src/chat_messages/chat_messages_mappers";
import * as constants from "../../functions/src/constants";

const BATCH_SIZE = 500;

/**
 * Duplicates messages to a new collection in V2 format
 */
export async function duplicateToV2Collection(db: Firestore) {
  try {
    let totalMessagesMigrated = 0;
    let leastCreatedAt: Date | null = null;

    do {
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

      // Process each document in the snapshot
      for (const doc of snapshot.docs) {
        const messageData = doc.data();
        // Skip if already migrated
        if (messageData[v2migrationFlag] === true) {
          continue;
        }
        // Convert to V2 format directly
        const messageV2 = convertV1ToV2(messageData);

        // Extract roomId from the document path (rooms/{roomId}/messages/{messageId})
        const pathParts = doc.ref.path.split("/");
        const roomId = pathParts[1];
        // Create new document in messages_v2 collection
        const newMessageRef = db
          .collection(constants.collectionsKeys.roomsCollection)
          .doc(roomId)
          .collection(constants.collectionsKeys.chatMessagesV2Collection)
          .doc(doc.id);
        batch.set(newMessageRef, messageV2);

        // Update the original message to set the migration flag
        // You can comment this to reduce write operations
        batch.update(doc.ref, { [v2migrationFlag]: true });

        pageCount++;
        totalMessagesMigrated++;
      }

      // Commit the entire page
      await batch.commit();
      console.log(`Committed page of ${pageCount} messages`);

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      leastCreatedAt = lastDoc.data().createdAt.toDate();
      console.log(`Last processed document createdAt: ${leastCreatedAt}`);
    } while (leastCreatedAt);

    console.log(
      `Successfully duplicated ${totalMessagesMigrated} messages to V2 collection`
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
      console.error("Error duplicating messages:", {
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
