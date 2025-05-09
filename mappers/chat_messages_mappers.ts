import type { DocumentData } from "@firebase/firestore-types";

export const v2migrationFlag = "V2MigrationCompleted";

/**
 * Converts a V1 message to V2
 */
export function convertV1ToV2(data: DocumentData): DocumentData {
  const result = { ...data };

  if (data.uri) {
    result.source = data.uri;
  }

  result[v2migrationFlag] = true;

  delete result.size;
  delete result.name;
  delete result.uri;
  delete result.status;

  return result;
}

/**
 * Converts a V2 message to V1
 */
export function convertV2ToV1(data: DocumentData): DocumentData {
  const result = { ...data };

  if (data.source) {
    result.uri = data.source;
  }
  delete result.source;

  result[v2migrationFlag] = true;

  return result;
}

/**
 * Makes a message compatible with both V1 and V2 formats
 */
export function toAllVersionsCompatible(data: DocumentData): DocumentData {
  const result = { ...data };

  if (data.uri && !data.source) {
    result.source = data.uri;
  }
  if (data.source && !data.uri) {
    result.uri = data.source;
  }

  result[v2migrationFlag] = true;

  return result;
}
