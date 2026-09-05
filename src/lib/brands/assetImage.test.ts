import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { InvalidBrandImageError, MAX_BRAND_IMAGE_BYTES, normalizeBrandImage } from "./assetImage";

describe("brand asset raster boundary", () => {
  it.each(["png", "jpeg", "webp"] as const)("decodes %s and emits a clean WebP", async (format) => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 4, background: "#123456" } }).toFormat(format).toBuffer();
    const normalized = await normalizeBrandImage(input, `image/${format}`);
    const metadata = await sharp(normalized.body).metadata();
    expect(normalized.contentType).toBe("image/webp");
    expect(metadata).toMatchObject({ format: "webp", width: 12, height: 8 });
    expect(metadata.exif).toBeUndefined();
  });
  it("rejects active SVG content even when labeled PNG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(normalizeBrandImage(svg, "image/png")).rejects.toBeInstanceOf(InvalidBrandImageError);
    await expect(normalizeBrandImage(svg, "image/svg+xml")).rejects.toBeInstanceOf(InvalidBrandImageError);
  });
  it("rejects truncated, empty, and oversized images", async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(MAX_BRAND_IMAGE_BYTES + 1), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])]) {
      await expect(normalizeBrandImage(bytes, "image/png")).rejects.toBeInstanceOf(InvalidBrandImageError);
    }
  });
  it("rejects mismatched MIME types", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    await expect(normalizeBrandImage(bytes, "image/jpeg")).rejects.toBeInstanceOf(InvalidBrandImageError);
  });
});
