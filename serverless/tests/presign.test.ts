// Unit tests for the presign Lambda — no binary required, S3 is mocked.

process.env.UPLOADS_BUCKET = "test-uploads-bucket";
process.env.CONVERTED_BUCKET = "test-converted-bucket";
process.env.AWS_REGION = "eu-west-1";

const mockGetSignedUrl = jest.fn().mockResolvedValue("https://mock-signed-url");

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((p) => ({ ...p, _type: "PutObject" })),
  GetObjectCommand: jest.fn().mockImplementation((p) => ({ ...p, _type: "GetObject" })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { handler } from "../presign-lambda/handler";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

function makeEvent(queryStringParameters?: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /upload-url",
    rawPath: "/upload-url",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: "GET",
        path: "/upload-url",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test",
      routeKey: "GET /upload-url",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
    queryStringParameters,
    isBase64Encoded: false,
  };
}

describe("presign handler", () => {
  beforeEach(() => {
    mockGetSignedUrl.mockClear();
  });

  it("returns 400 when fakeId is missing", async () => {
    const res = await handler(makeEvent()) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string).error).toMatch(/fakeId/);
  });

  it("returns 400 when fakeId is empty string", async () => {
    const res = await handler(makeEvent({ fakeId: "  " })) as any;
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when fakeId contains invalid characters", async () => {
    const res = await handler(makeEvent({ fakeId: "dev/bad;chars" })) as any;
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when fakeId exceeds 64 characters", async () => {
    const res = await handler(makeEvent({ fakeId: "a".repeat(65) })) as any;
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with uploadUrl and convertedUrl for a valid fakeId", async () => {
    const res = await handler(makeEvent({ fakeId: "dev_abc123" })) as any;
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body as string);
    expect(body.uploadUrl).toBe("https://mock-signed-url");
    expect(body.convertedUrl).toBe("https://mock-signed-url");
    expect(body.uploadId).toMatch(/^[a-f0-9]{32}$/);
  });

  it("generates keys that embed the fakeId", async () => {
    const res = await handler(makeEvent({ fakeId: "dev_mysha" })) as any;
    expect(res.statusCode).toBe(200);

    // getSignedUrl called twice: once for upload (PutObject), once for converted (GetObject)
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);

    const [, putCommand] = mockGetSignedUrl.mock.calls[0];
    const [, getCommand] = mockGetSignedUrl.mock.calls[1];

    expect((putCommand as any).Key).toMatch(/^dev_mysha\/.+\.eu5$/);
    expect((getCommand as any).Key).toMatch(/^dev_mysha\/.+\.json$/);

    // Both keys share the same uploadId segment
    const uploadId = (putCommand as any).Key.split("/")[1].replace(".eu5", "");
    expect((getCommand as any).Key).toContain(uploadId);
  });

  it("accepts fakeId with hyphens and underscores", async () => {
    const res = await handler(makeEvent({ fakeId: "dev_sha-abc_123" })) as any;
    expect(res.statusCode).toBe(200);
  });
});
