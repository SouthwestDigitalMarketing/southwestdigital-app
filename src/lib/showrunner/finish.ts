import { access, writeFile } from "node:fs/promises";
import path from "node:path";

const BATCH = /^[A-Za-z0-9-]{1,60}$/;

/** On ripley, leave the same .finish.json the send app writes so the inbox run starts the build. */
export async function writeLocalFinish(batch: string, note: string): Promise<boolean> {
  const inbox = process.env.PHONE_INTAKE_INBOX ?? "";
  if (!inbox || !BATCH.test(batch)) return false;
  const folder = path.join(inbox, "done", batch);
  try {
    await access(folder);
  } catch {
    return false;
  }
  await writeFile(
    path.join(folder, ".finish.json"),
    JSON.stringify({ note: note.slice(0, 2000), at: Math.floor(Date.now() / 1000) }),
  );
  return true;
}

/** On ripley, leave .thumbnail.json so the review timer remakes the picture without waiting on the next poll. */
export async function writeLocalThumbnail(batch: string, text: string): Promise<boolean> {
  const inbox = process.env.PHONE_INTAKE_INBOX ?? "";
  const wording = text.trim().slice(0, 60);
  if (!inbox || !BATCH.test(batch) || !wording) return false;
  const folder = path.join(inbox, "done", batch);
  try {
    await access(folder);
  } catch {
    return false;
  }
  await writeFile(
    path.join(folder, ".thumbnail.json"),
    JSON.stringify({ text: wording, at: Math.floor(Date.now() / 1000) }),
  );
  return true;
}
