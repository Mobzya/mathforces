export type OcrResult = {
  confidence: number;
  error: string;
  geometryDetected: boolean;
  latencyMs: number;
  provider: string;
  success: boolean;
  text: string;
};

export interface OcrService {
  recognize(image: Uint8Array): Promise<OcrResult>;
}
