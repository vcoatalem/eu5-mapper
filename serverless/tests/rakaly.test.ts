// Integration test for the rakaly Lambda.
// Mocks S3 read/write but runs the actual rakaly binary.
// Requires the binary at rakaly-lambda/rakaly — run `make prepare` first.

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const FIXTURE_EU5 = path.join(__dirname, "fixtures/SP_SAR.eu5");
const RAKALY_BINARY = path.join(__dirname, "../rakaly-lambda/rakaly");
// Binary is Linux x86_64 — skip on other platforms even if the file is present
const canRunBinary = fs.existsSync(RAKALY_BINARY) && process.platform === "linux";

process.env.MELTED_BUCKET = "test-melted-bucket";
process.env.RAKALY_PATH = RAKALY_BINARY;
process.env.RAKALY_ARGS = "melt --unknown-key stringify --to-stdout";
process.env.AWS_REGION = "eu-west-1";

// Capture what gets uploaded to S3
let capturedPut: { Bucket: string; Key: string; Body: Buffer } | null = null;

const mockSend = jest.fn().mockImplementation((command: any) => {
  if (command._type === "GetObject") {
    const bytes = fs.readFileSync(FIXTURE_EU5);
    return Promise.resolve({
      Body: { transformToByteArray: async () => new Uint8Array(bytes) },
    });
  }
  if (command._type === "PutObject") {
    capturedPut = {
      Bucket: command.Bucket,
      Key: command.Key,
      Body: Buffer.from(command.Body),
    };
    return Promise.resolve({});
  }
  return Promise.resolve({});
});

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn().mockImplementation((p) => ({ ...p, _type: "GetObject" })),
  PutObjectCommand: jest.fn().mockImplementation((p) => ({ ...p, _type: "PutObject" })),
}));

import { handler, deriveOutputKey } from "../rakaly-lambda/handler";

describe("deriveOutputKey", () => {
  it("replaces .eu5 with .melted.txt.gz", () => {
    expect(deriveOutputKey("dev_abc/upload123.eu5")).toBe("dev_abc/upload123.melted.txt.gz");
  });

  it("leaves keys without .eu5 unchanged", () => {
    expect(deriveOutputKey("dev_abc/file.other")).toBe("dev_abc/file.other");
  });
});

const describeWithBinary = canRunBinary ? describe : describe.skip;

describeWithBinary("rakaly handler (requires binary)", () => {
  beforeEach(() => {
    capturedPut = null;
    mockSend.mockClear();
  });

  it("processes an S3 event, gzips rakaly output, and uploads to melted bucket", async () => {
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: "test-uploads-bucket" },
            object: { key: "dev_test%2Fupload123.eu5" },
          },
        },
      ],
    };

    await handler(event as any);

    expect(capturedPut).not.toBeNull();
    expect(capturedPut!.Bucket).toBe("test-melted-bucket");
    expect(capturedPut!.Key).toBe("dev_test/upload123.melted.txt.gz");

    // Output must be valid gzip
    const decompressed = zlib.gunzipSync(capturedPut!.Body).toString("utf-8");
    expect(decompressed.length).toBeGreaterThan(0);
    // Clausewitz plain-text format always contains key=value pairs
    expect(decompressed).toMatch(/\w+=\S/);
  }, 120_000); // 2 min — SP_SAR.eu5 is 39 MB

  it("processes an HTTP event and returns 200", async () => {
    const event = {
      version: "2.0",
      routeKey: "POST /invoke/rakaly",
      rawPath: "/invoke/rakaly",
      rawQueryString: "",
      headers: {},
      requestContext: {
        accountId: "123",
        apiId: "local",
        domainName: "localhost",
        domainPrefix: "localhost",
        http: { method: "POST", path: "/invoke/rakaly", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
        requestId: "test",
        routeKey: "POST /invoke/rakaly",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
      body: JSON.stringify({ bucket: "test-uploads-bucket", key: "dev_test/upload123.eu5" }),
      isBase64Encoded: false,
    };

    const res = await handler(event as any) as any;

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.outputKey).toBe("dev_test/upload123.melted.txt.gz");
  }, 120_000);

  it("returns 500 if rakaly binary fails", async () => {
    // Point to a non-existent binary to simulate failure
    process.env.RAKALY_PATH = "/nonexistent/rakaly";

    const event = {
      version: "2.0",
      routeKey: "POST /invoke/rakaly",
      rawPath: "/invoke/rakaly",
      rawQueryString: "",
      headers: {},
      requestContext: {
        accountId: "123",
        apiId: "local",
        domainName: "localhost",
        domainPrefix: "localhost",
        http: { method: "POST", path: "/invoke/rakaly", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
        requestId: "test",
        routeKey: "POST /invoke/rakaly",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
      body: JSON.stringify({ bucket: "test-uploads-bucket", key: "dev_test/upload123.eu5" }),
      isBase64Encoded: false,
    };

    const res = await handler(event as any) as any;
    expect(res.statusCode).toBe(500);

    process.env.RAKALY_PATH = RAKALY_BINARY; // restore
  });
});
