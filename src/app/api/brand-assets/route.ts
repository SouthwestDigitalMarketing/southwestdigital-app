import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { normalizeBrandColor } from "@/lib/brands/colors";
import { getPublicBrandAsset, putPublicBrandAsset } from "@/lib/storage/r2";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

export async function POST(request: Request) {
  try {
    const { brand } = await requireStaffBrandOrThrow();
    const formData = await request.formData();
    const file = formData.get("file");
    const kindValue = formData.get("kind");
    const kind = typeof kindValue === "string" ? kindValue : "";
    const suggestedColor = normalizeBrandColor(String(formData.get("suggestedColor") ?? ""));

    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!new Set(["logo", "mark", "logo-dark", "mark-dark"]).has(kind)) {
      return NextResponse.json({ error: "Unknown asset type." }, { status: 400 });
    }
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use a PNG, JPEG, WebP, or SVG image." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Images must be between 1 byte and 2 MB." }, { status: 400 });
    }

    const extension = ALLOWED_CONTENT_TYPES.get(file.type)!;
    const key = `brands/${brand.id}/logos/${kind}-${randomUUID()}.${extension}`;
    const url = await putPublicBrandAsset({
      key,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });

    const currentTheme = await prisma.brandTheme.findUnique({
      where: { brandId: brand.id },
      select: { primaryColor: true },
    });
    const shouldApplySuggestion = Boolean(suggestedColor) && (!currentTheme || currentTheme.primaryColor.toLowerCase() === "#17324d");

    await prisma.brandTheme.upsert({
      where: { brandId: brand.id },
      create: {
        brandId: brand.id,
        ...(kind === "logo"
          ? { logoUrl: url }
          : kind === "mark"
            ? { logoMarkUrl: url }
            : kind === "logo-dark"
              ? { logoDarkUrl: url }
              : { logoMarkDarkUrl: url }),
        ...(shouldApplySuggestion ? { primaryColor: suggestedColor! } : {}),
      },
      update: {
        ...(kind === "logo"
          ? { logoUrl: url }
          : kind === "mark"
            ? { logoMarkUrl: url }
            : kind === "logo-dark"
              ? { logoDarkUrl: url }
              : { logoMarkDarkUrl: url }),
        ...(shouldApplySuggestion ? { primaryColor: suggestedColor! } : {}),
      },
    });

    return NextResponse.json({ url, suggestedColor: shouldApplySuggestion ? suggestedColor : null });
  } catch (error) {
    console.error("Brand asset upload failed", error);
    return NextResponse.json({ error: "Could not upload the brand asset." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { brand } = await requireStaffBrandOrThrow();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "logo" && kind !== "mark" && kind !== "logo-dark" && kind !== "mark-dark") {
      return NextResponse.json({ error: "Unknown asset type." }, { status: 400 });
    }

    const theme = await prisma.brandTheme.findUnique({
      where: { brandId: brand.id },
      select: { logoUrl: true, logoMarkUrl: true, logoDarkUrl: true, logoMarkDarkUrl: true },
    });
    const url =
      kind === "logo"
        ? theme?.logoUrl
        : kind === "mark"
          ? theme?.logoMarkUrl
          : kind === "logo-dark"
            ? theme?.logoDarkUrl
            : theme?.logoMarkDarkUrl;
    if (!url) return NextResponse.json({ error: "No logo has been uploaded." }, { status: 404 });

    const asset = await getPublicBrandAsset(url);
    const body = asset.body.buffer.slice(
      asset.body.byteOffset,
      asset.body.byteOffset + asset.body.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      headers: { "Content-Type": asset.contentType, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Brand asset read failed", error);
    return NextResponse.json({ error: "Could not read the brand asset." }, { status: 500 });
  }
}
