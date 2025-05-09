import { onDocumentCreated } from "firebase-functions/v2/firestore";

import * as constants from "../constants";

import { toAllVersionsCompatible } from "./chat_messages_mappers";

export const onMessageCreatedMigrate = onDocumentCreated(
  {
    document: `${constants.collectionsKeys.roomsCollection}/{roomId}/${constants.collectionsKeys.chatMessagesCollection}/{messageId}`,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const messageData = snapshot.data();

    // Skip if already migrated
    if (messageData.V2MigrationCompleted === true) {
      return;
    }

    try {
      const allVersionsMessage = toAllVersionsCompatible(messageData);
      await snapshot.ref.update(allVersionsMessage);
      console.log(
        `Updated message ${snapshot.id} to be compatible with all versions`
      );
    } catch (error) {
      console.error("Error migrating message:", error);
      throw error;
    }
  }
);
