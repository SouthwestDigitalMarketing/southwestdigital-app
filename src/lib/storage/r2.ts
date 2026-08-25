import "server-only";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type R2EnvironmentKey =
  | "CLOUDFLARE_ACCOUNT_ID"
  | "CLOUDFLARE_R2_ACCESS_KEY_ID"
  | "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  | "CLOUDFLARE_R2_BUCKET"
  | "CLOUDFLARE_R2_PUBLIC_BASE_URL";

function required(name: R2EnvironmentKey) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getR2Config() {
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const publicBaseUrl = required("CLOUDFLARE_R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const parsed = new URL(publicBaseUrl);
  if (parsed.protocol !== "https:") throw new Error("CLOUDFLARE_R2_PUBLIC_BASE_URL must use HTTPS.");

  return {
    bucket: required("CLOUDFLARE_R2_BUCKET"),
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
}

export async function putPublicBrandAsset({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  const { bucket, client, publicBaseUrl } = getR2Config();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
