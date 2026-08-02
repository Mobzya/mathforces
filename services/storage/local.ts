import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { ObjectStorage, StoredObject } from "@/services/storage/types";

function storageRoot(): string {
  const configured =
    process.env.SUBMISSION_STORAGE_DIR ?? "./storage/submissions";
  return isAbsolute(configured)
    ? configured
    : resolve(process.cwd(), configured);
}

function resolveStorageKey(key: string): string {
  const root = storageRoot();
  const target = resolve(root, key);
  const pathFromRoot = relative(root, target);

  if (
    !key ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  return target;
}

export const localSubmissionStorage: ObjectStorage = {
  async delete(key: string): Promise<void> {
    await rm(resolveStorageKey(key), { force: true });
  },

  async healthCheck() {
    try {
      await mkdir(storageRoot(), { recursive: true });
      await access(storageRoot());
      return { provider: "local-filesystem", status: "up" as const };
    } catch {
      return { provider: "local-filesystem", status: "down" as const };
    }
  },

  async read(key: string): Promise<Uint8Array> {
    return readFile(resolveStorageKey(key));
  },

  async store({
    bytes,
    extension
  }: {
    bytes: Uint8Array;
    extension: string;
  }): Promise<StoredObject> {
    const now = new Date();
    const key = join(
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${randomUUID()}.${extension}`
    );
    const target = resolveStorageKey(key);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });

    return {
      key,
      sizeBytes: bytes.byteLength
    };
  }
};
