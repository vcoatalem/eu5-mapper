import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type {
  S3Event,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { gunzipSync } from "zlib";
import { parseSaveFile } from "./parse";

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3)
    _s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });
  return _s3;
}

function isS3Event(event: unknown): event is S3Event {
  return (
    typeof event === "object" &&
    event !== null &&
    "Records" in event &&
    Array.isArray((event as S3Event).Records) &&
    (event as S3Event).Records[0]?.s3 !== undefined
  );
}

function decodeS3Key(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

/** {fakeId}/{uploadId}.melted.txt.gz → {fakeId}/{uploadId}.json */
export function deriveOutputKey(inputKey: string): string {
  return inputKey.replace(/\.melted\.txt\.gz$/, ".json");
}

async function downloadFromS3(
  bucket: string,
  key: string,
): Promise<Uint8Array> {
  const res = await getS3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) throw new Error(`Empty S3 body for s3://${bucket}/${key}`);
  return res.Body.transformToByteArray();
}

// ── Memory pressure detection ──────────────────────────────────────────────────

export class MemoryPressureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryPressureError";
  }
}

// ── Memory logging ─────────────────────────────────────────────────────────────

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function logMem(label: string, extra?: Record<string, string>): void {
  const m = process.memoryUsage();
  console.log(
    JSON.stringify({
      checkpoint: label,
      rss: mb(m.rss), // total process memory (includes WASM)
      heapUsed: mb(m.heapUsed),
      heapTotal: mb(m.heapTotal),
      external: mb(m.external), // WASM linear memory lives here
      ...extra,
    }),
  );
}

// ── Core processing ────────────────────────────────────────────────────────────

async function processFile(
  inputBucket: string,
  inputKey: string,
  outputBucket: string,
  outputKey: string,
) {
  logMem("start");

  const t0 = Date.now();
  const gzippedBytes = await downloadFromS3(inputBucket, inputKey);
  logMem("after_s3_download", {
    gzippedSize: mb(gzippedBytes.byteLength),
    elapsed: `${Date.now() - t0}ms`,
  });

  const decompressed = gunzipSync(gzippedBytes);
  logMem("after_gunzip", {
    decompressedSize: mb(decompressed.byteLength),
    elapsed: `${Date.now() - t0}ms`,
  });

  const parsed = await parseSaveFile(decompressed, (label) => {
    logMem(`parse_checkpoint_${label}`, { elapsed: `${Date.now() - t0}ms` });
  });
  logMem("after_parse", { elapsed: `${Date.now() - t0}ms` });

  const body = JSON.stringify(parsed);
  logMem("after_json_stringify", {
    outputSize: mb(Buffer.byteLength(body, "utf-8")),
    elapsed: `${Date.now() - t0}ms`,
  });

  await getS3().send(
    new PutObjectCommand({
      Bucket: outputBucket,
      Key: outputKey,
      Body: body,
      ContentType: "application/json",
    }),
  );

  logMem("after_s3_upload", { elapsed: `${Date.now() - t0}ms` });

  return parsed;
}

export const handler = async (
  event: S3Event | APIGatewayProxyEventV2,
): Promise<void | APIGatewayProxyResultV2> => {
  const convertedBucket = process.env.CONVERTED_BUCKET!;

  // ── S3 event trigger (deployed pipeline) ──────────────────────────────────
  if (isS3Event(event)) {
    const record = event.Records[0].s3;
    const inputBucket = record.bucket.name;
    const inputKey = decodeS3Key(record.object.key);
    const outputKey = deriveOutputKey(inputKey);

    await processFile(inputBucket, inputKey, convertedBucket, outputKey);
    return;
  }

  // ── HTTP fallback (local dev / manual testing) ────────────────────────────
  try {
    const httpEvent = event as APIGatewayProxyEventV2;
    const raw = httpEvent.body ?? "{}";
    const body = JSON.parse(
      httpEvent.isBase64Encoded ? Buffer.from(raw, "base64").toString() : raw,
    );

    const inputBucket: string = body.bucket;
    const inputKey: string = body.key;
    if (!inputBucket || !inputKey) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "missing bucket or key" }),
      };
    }

    const outputBucket: string = body.outputBucket ?? convertedBucket;
    const outputKey: string = body.outputKey ?? deriveOutputKey(inputKey);

    const result = await processFile(
      inputBucket,
      inputKey,
      outputBucket,
      outputKey,
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ok: true,
        outputBucket: outputBucket,
        outputKey,
        result,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "unknown error",
      }),
    };
  }
};
