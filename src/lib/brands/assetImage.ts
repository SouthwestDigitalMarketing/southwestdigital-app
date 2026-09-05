import "server-only";
import sharp from "sharp";

export const MAX_BRAND_IMAGE_BYTES = 2 * 1024 * 1024;

export class InvalidBrandImageError extends Error {
  constructor() {
    super("Use a valid PNG, JPEG, or WebP image up to 2 MB and 16 megapixels. SVG files are not supported.");
  }
}

/** Check bytes before invoking a decoder, then emit only fresh raster pixels. */
export async function normalizeBrandImage(bytes: Uint8Array, contentType: string) {
  const input = Buffer.from(bytes);
  if (!input.length || input.length > MAX_BRAND_IMAGE_BYTES) throw new InvalidBrandImageError();
  const format = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
    : input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff ? "jpeg"
    : input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP" ? "webp"
    : null;
  if (!format || contentType !== `image/${format}`) throw new InvalidBrandImageError();
  try {
    const body = await sharp(input, { limitInputPixels: 16_000_000, failOn: "warning", autoOrient: true })
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ lossless: true })
      .toBuffer();
    if (body.length > MAX_BRAND_IMAGE_BYTES) throw new InvalidBrandImageError();
    return { body, contentType: "image/webp", extension: "webp" } as const;
  } catch {
    throw new InvalidBrandImageError();
  }
}
