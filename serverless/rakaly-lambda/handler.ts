import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Event, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { spawnSync } from "child_process";
import { gzipSync } from "zlib";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) _s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });
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

/** {fakeId}/{uploadId}.eu5 → {fakeId}/{uploadId}.melted.txt.gz */
export function deriveOutputKey(inputKey: string): string {
  return inputKey.replace(/\.eu5$/, ".melted.txt.gz");
}

async function downloadFromS3(bucket: string, key: string): Promise<Uint8Array> {
  const res = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty S3 body for s3://${bucket}/${key}`);
  return res.Body.transformToByteArray();
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function log(checkpoint: string, extra?: Record<string, string>): void {
  console.log(JSON.stringify({ checkpoint, ...extra }));
}

async function processFile(
  inputBucket: string,
  inputKey: string,
  outputBucket: string,
  outputKey: string
): Promise<void> {
  const rakalyPath = process.env.RAKALY_PATH ?? "/opt/bin/rakaly";
  const rakalyArgs = (
    process.env.RAKALY_ARGS ?? "melt --unknown-key stringify --to-stdout"
  ).split(" ");

  const t0 = Date.now();

  const fileBytes = await downloadFromS3(inputBucket, inputKey);
  log("after_s3_download", {
    inputSize: mb(fileBytes.byteLength),
    elapsed: `${Date.now() - t0}ms`,
  });

  const tmpPath = path.join(tmpdir(), `rakaly-${Date.now()}.eu5`);
  writeFileSync(tmpPath, fileBytes);
  log("after_write_tmp", { elapsed: `${Date.now() - t0}ms` });

  try {
    const result = spawnSync(rakalyPath, [...rakalyArgs, tmpPath], {
      maxBuffer: 2 * 1024 * 1024 * 1024, // 2 GB — melted files can be large
    });
    log("after_rakaly_melt", {
      stdoutSize: mb(result.stdout?.byteLength ?? 0),
      elapsed: `${Date.now() - t0}ms`,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString("utf-8") ?? "no stderr";
      throw new Error(`rakaly exited with code ${result.status}: ${stderr}`);
    }

    const gzipped = gzipSync(result.stdout, { level: 1 });
    log("after_gzip", {
      gzippedSize: mb(gzipped.byteLength),
      elapsed: `${Date.now() - t0}ms`,
    });

    await getS3().send(
      new PutObjectCommand({
        Bucket: outputBucket,
        Key: outputKey,
        Body: gzipped,
        ContentType: "text/plain; charset=utf-8",
        ContentEncoding: "gzip",
      })
    );
    log("after_s3_upload", { elapsed: `${Date.now() - t0}ms` });
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  }
}

export const handler = async (
  event: S3Event | APIGatewayProxyEventV2
): Promise<void | APIGatewayProxyResultV2> => {
  const meltedBucket = process.env.MELTED_BUCKET!;

  // ── S3 event trigger (deployed pipeline) ──────────────────────────────────
  if (isS3Event(event)) {
    const record = event.Records[0].s3;
    const inputBucket = record.bucket.name;
    const inputKey = decodeS3Key(record.object.key);
    const outputKey = deriveOutputKey(inputKey);

    await processFile(inputBucket, inputKey, meltedBucket, outputKey);
    return;
  }

  // ── HTTP fallback (local dev / manual testing) ────────────────────────────
  try {
    const httpEvent = event as APIGatewayProxyEventV2;
    const raw = httpEvent.body ?? "{}";
    const body = JSON.parse(
      httpEvent.isBase64Encoded ? Buffer.from(raw, "base64").toString() : raw
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

    const outputBucket: string = body.outputBucket ?? meltedBucket;
    const outputKey: string = body.outputKey ?? deriveOutputKey(inputKey);

    await processFile(inputBucket, inputKey, outputBucket, outputKey);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ok: true, outputBucket, outputKey }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err instanceof Error ? err.message : "unknown error",
      }),
    };
  }
};
