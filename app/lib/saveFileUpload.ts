import { ZodSaveData, type SaveData } from "@shared/saveData";

const PRESIGN_API_URL = process.env.NEXT_PUBLIC_PRESIGN_API_URL;

interface PresignResponse {
  uploadUrl: string;
  convertedUrl: string;
  uploadId: string;
}

/**
 * Full pipeline: get pre-signed URLs → upload save file → poll for parsed JSON.
 * Only call this when getFakeId() returns a value (dev mode only).
 */
export async function loadGameSaveFile(
  file: File,
  fakeId: string
): Promise<SaveData> {
  if (!PRESIGN_API_URL) {
    throw new Error("NEXT_PUBLIC_PRESIGN_API_URL is not set");
  }

  // 1. Get pre-signed URLs from presign Lambda
  const presignRes = await fetch(
    `${PRESIGN_API_URL}/upload-url?fakeId=${encodeURIComponent(fakeId)}`
  );
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(`Failed to get upload URL: ${err.error ?? presignRes.status}`);
  }
  const { uploadUrl, convertedUrl }: PresignResponse = await presignRes.json();

  // 2. Upload directly to S3 — no server in the middle
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!uploadRes.ok) {
    throw new Error(`S3 upload failed: ${uploadRes.status}`);
  }

  // 3. Poll for the converted JSON (written by jomini Lambda)
  const jsonText = await pollUntilReady(convertedUrl);

  return ZodSaveData.parse(JSON.parse(jsonText));
}

/**
 * Polls a pre-signed S3 GET URL with HEAD requests until the object exists (200),
 * then fetches and returns the body as text.
 *
 * Uses exponential backoff: 2s → 4s → ... → 30s cap.
 * Throws if the object doesn't appear within timeoutMs (default 5 min).
 */
export async function pollUntilReady(
  url: string,
  timeoutMs = 300_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let delay = 2_000;

  while (Date.now() < deadline) {
    const res = await fetch(url, { method: "HEAD" });

    if (res.ok) {
      const content = await fetch(url);
      if (!content.ok) {
        throw new Error(`Failed to retrieve converted file: ${content.status}`);
      }
      return content.text();
    }

    // 403/404 = not ready yet (object doesn't exist)
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Unexpected status while polling: ${res.status}`);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await sleep(Math.min(delay, remaining, 30_000));
    delay = Math.min(delay * 1.5, 30_000);
  }

  throw new Error("Save file processing timed out after 5 minutes");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
