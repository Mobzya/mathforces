import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: COST,
        p: PARALLELIZATION,
        r: BLOCK_SIZE
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt);

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("hex"),
    hash.toString("hex")
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltHex, hashHex] = storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    Number(cost) !== COST ||
    Number(blockSize) !== BLOCK_SIZE ||
    Number(parallelization) !== PARALLELIZATION ||
    !saltHex ||
    !hashHex
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
