export type StoredObject = {
  key: string;
  sizeBytes: number;
};

export interface ObjectStorage {
  delete(key: string): Promise<void>;
  healthCheck(): Promise<{ provider: string; status: "up" | "down" }>;
  read(key: string): Promise<Uint8Array>;
  store(input: {
    bytes: Uint8Array;
    extension: string;
  }): Promise<StoredObject>;
}
