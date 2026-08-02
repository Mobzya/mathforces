export type PreprocessResult = {
  bytes: Uint8Array;
  latencyMs: number;
  provider: string;
};

export interface ImagePreprocessor {
  prepare(image: Uint8Array): Promise<PreprocessResult>;
}

// The MVP keeps the original bytes. This adapter boundary is where rotation,
// contrast normalization and perspective correction can be added later.
export const imagePreprocessor: ImagePreprocessor = {
  async prepare(image) {
    const startedAt = Date.now();
    return {
      bytes: image,
      latencyMs: Date.now() - startedAt,
      provider: "mathforces-image-pass-through-v1"
    };
  }
};
