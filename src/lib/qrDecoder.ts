/**
 * 영상 프레임에서 QR 문자열을 읽는 함수를 만든다(브라우저 전용).
 * 1순위: 브라우저 내장 BarcodeDetector(안드로이드 Chrome 등). 2순위: jsQR(순수 JS, 필요할 때만 불러옴).
 */

export type QrDecode = (video: HTMLVideoElement) => Promise<string | null>;
export type DecoderKind = "barcode-detector" | "jsqr";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

async function nativeDecoder(): Promise<QrDecode | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = await Ctor.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) return null;
    const detector = new Ctor({ formats: ["qr_code"] });
    return async (video) => {
      const found = await detector.detect(video);
      return found.find((b) => b.rawValue)?.rawValue ?? null;
    };
  } catch {
    return null;
  }
}

/** 큰 프레임은 줄여서 읽는다(속도). QR이 화면 가운데 프레임 안에 오므로 640px이면 충분하다. */
const MAX_SIDE = 640;

async function jsqrDecoder(): Promise<QrDecode> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!ctx || !w || !h) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    ctx.drawImage(video, 0, 0, cw, ch);
    const img = ctx.getImageData(0, 0, cw, ch);
    return jsQR(img.data, cw, ch, { inversionAttempts: "dontInvert" })?.data || null;
  };
}

/** 내장 검출기가 실행 중 오류를 내면 jsQR로 바꿔 계속 읽는다. */
export async function createQrDecoder(): Promise<{ kind: DecoderKind; decode: QrDecode }> {
  const native = await nativeDecoder();
  if (!native) return { kind: "jsqr", decode: await jsqrDecoder() };
  let fallback: QrDecode | null = null;
  const result: { kind: DecoderKind; decode: QrDecode } = {
    kind: "barcode-detector",
    decode: async (video) => {
      if (fallback) return fallback(video);
      try {
        return await native(video);
      } catch {
        fallback = await jsqrDecoder();
        result.kind = "jsqr";
        return fallback(video);
      }
    },
  };
  return result;
}
