import { tesseractOcr } from "@/services/ocr/tesseract";

export const ocrService = tesseractOcr;
export type { OcrResult, OcrService } from "@/services/ocr/types";
