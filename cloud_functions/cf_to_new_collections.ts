import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import * as constants from "../constants";

import {
  convertV1ToV2,
  convertV2ToV1,
  v2migrationFlag,
} from "./chat_messages_mappers";

export const onV1MessageCreated = onDocumentCreated(
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
    if (messageData[v2migrationFlag] === true) {
      return;
    }

    try {
      const messageV2 = convertV1ToV2(messageData);
      const db = getFirestore();
      const v2Ref = db
        .collection(constants.collectionsKeys.roomsCollection)
        .doc(event.params.roomId)
        .collection(constants.collectionsKeys.chatMessagesCollection)
        .doc(snapshot.id);
      await v2Ref.set(messageV2);
      await snapshot.ref.update({ [v2migrationFlag]: true });
      console.log(`Created V2 copy of message ${snapshot.id}`);
    } catch (error) {
      console.error("Error migrating message:", error);
      throw error;
    }
  }
);

export const onV2MessageCreated = onDocumentCreated(
  {
    document: `${constants.collectionsKeys.roomsCollection}/{roomId}/${constants.collectionsKeys.chatMessagesCollection}_v2/{messageId}`,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const messageData = snapshot.data();
    // Skip if already migrated
    if (messageData[v2migrationFlag] === true) {
      return;
    }
    const db = getFirestore();

    try {
      const messageV1 = convertV2ToV1(messageData);

      const v1Ref = db
        .collection(constants.collectionsKeys.roomsCollection)
        .doc(event.params.roomId)
        .collection(constants.collectionsKeys.chatMessagesCollection)
        .doc(snapshot.id);
      await v1Ref.set(messageV1);
      await snapshot.ref.update({ [v2migrationFlag]: true });

      console.log(`Created V1 copy of message ${snapshot.id}`);
    } catch (error) {
      console.error("Error migrating V2 message:", error);
      throw error;
    }
  }
);
