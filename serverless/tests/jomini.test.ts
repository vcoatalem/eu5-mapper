// Integration test for the jomini Lambda.
// Mocks S3 read/write but runs the actual jomini WASM parser.
// Uses tests/fixtures/SP_SAR.melted.txt.gz as input.

import * as fs from "fs";
import * as path from "path";

const FIXTURE_GZ = path.join(__dirname, "fixtures/SP_SAR.melted.txt.gz");

process.env.CONVERTED_BUCKET = "test-converted-bucket";
process.env.AWS_REGION = "eu-west-1";

let capturedPut: { Bucket: string; Key: string; Body: string } | null = null;

const mockSend = jest.fn().mockImplementation((command: any) => {
  if (command._type === "GetObject") {
    const bytes = fs.readFileSync(FIXTURE_GZ);
    return Promise.resolve({
      Body: { transformToByteArray: async () => new Uint8Array(bytes) },
    });
  }
  if (command._type === "PutObject") {
    capturedPut = {
      Bucket: command.Bucket,
      Key: command.Key,
      Body:
        typeof command.Body === "string"
          ? command.Body
          : command.Body.toString("utf-8"),
    };
    return Promise.resolve({});
  }
  return Promise.resolve({});
});

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest
    .fn()
    .mockImplementation((p) => ({ ...p, _type: "GetObject" })),
  PutObjectCommand: jest
    .fn()
    .mockImplementation((p) => ({ ...p, _type: "PutObject" })),
}));

import { handler, deriveOutputKey } from "../jomini-lambda/handler";

describe("deriveOutputKey", () => {
  it("replaces .melted.txt.gz with .json", () => {
    expect(deriveOutputKey("dev_abc/upload123.melted.txt.gz")).toBe(
      "dev_abc/upload123.json",
    );
  });
});

describe("jomini handler", () => {
  beforeEach(() => {
    capturedPut = null;
    mockSend.mockClear();
  });

  it("processes an S3 event and uploads parsed JSON to converted bucket", async () => {
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: "test-melted-bucket" },
            object: { key: "dev_test%2Fupload123.melted.txt.gz" },
          },
        },
      ],
    };

    await handler(event as any);

    expect(capturedPut).not.toBeNull();
    expect(capturedPut!.Bucket).toBe("test-converted-bucket");
    expect(capturedPut!.Key).toBe("dev_test/upload123.json");

    const parsed = JSON.parse(capturedPut!.Body);

    // Shape assertions — not tied to specific save values
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("countryCode");
    expect(parsed).toHaveProperty("locations");
    expect(parsed).toHaveProperty("locationBuildings");

    if (parsed.locations !== null) {
      expect(Array.isArray(parsed.locations)).toBe(true);
    }
  });

  it("processes an HTTP event and returns 200 with parsed result", async () => {
    const event = {
      version: "2.0",
      routeKey: "POST /invoke/jomini",
      rawPath: "/invoke/jomini",
      rawQueryString: "",
      headers: {},
      requestContext: {
        accountId: "123",
        apiId: "local",
        domainName: "localhost",
        domainPrefix: "localhost",
        http: {
          method: "POST",
          path: "/invoke/jomini",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "test",
        },
        requestId: "test",
        routeKey: "POST /invoke/jomini",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
      body: JSON.stringify({
        bucket: "test-melted-bucket",
        key: "dev_test/upload123.melted.txt.gz",
      }),
      isBase64Encoded: false,
    };

    const res = (await handler(event as any)) as any;

    expect((res as any).statusCode).toBe(200);
    const body = JSON.parse((res as any).body);
    expect(body.ok).toBe(true);
    expect(body.result).toHaveProperty("data.version");
    expect(body.result).toHaveProperty("data.countryCode");
    expect(body.result).toHaveProperty("tasks");
  });

  it("returns 400 when bucket or key is missing from HTTP event", async () => {
    const event = {
      version: "2.0",
      routeKey: "POST /invoke/jomini",
      rawPath: "/invoke/jomini",
      rawQueryString: "",
      headers: {},
      requestContext: {
        accountId: "123",
        apiId: "local",
        domainName: "localhost",
        domainPrefix: "localhost",
        http: {
          method: "POST",
          path: "/invoke/jomini",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "test",
        },
        requestId: "test",
        routeKey: "POST /invoke/jomini",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
      body: "{}",
      isBase64Encoded: false,
    };

    const res = (await handler(event as any)) as any;
    expect((res as any).statusCode).toBe(400);
  });
});
