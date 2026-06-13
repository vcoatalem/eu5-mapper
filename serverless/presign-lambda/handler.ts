import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";

const FAKE_ID_PATTERN = /^[\w-]{1,64}$/;
const UPLOAD_TTL_SECONDS = 900; // 15 min — time the user has to upload
const CONVERTED_TTL_SECONDS = 3600; // 1 hr — must cover worst-case pipeline duration

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) _s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });
  return _s3;
}

function jsonResponse(statusCode: number, body: object): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const fakeId = event.queryStringParameters?.fakeId?.trim();

  if (!fakeId || !FAKE_ID_PATTERN.test(fakeId)) {
    return jsonResponse(400, {
      error: "missing or invalid fakeId — must match /^[\\w-]{1,64}$/",
    });
  }

  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const convertedBucket = process.env.CONVERTED_BUCKET!;

  const uploadId = randomUUID().replace(/-/g, "");
  const uploadKey = `${fakeId}/${uploadId}.eu5`;
  const convertedKey = `${fakeId}/${uploadId}.json`;

  const s3 = getS3();

  const [uploadUrl, convertedUrl, pollUrl] = await Promise.all([
    getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: uploadsBucket,
        Key: uploadKey,
        ContentType: "application/octet-stream",
      }),
      { expiresIn: UPLOAD_TTL_SECONDS }
    ),
    getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: convertedBucket,
        Key: convertedKey,
      }),
      { expiresIn: CONVERTED_TTL_SECONDS }
    ),
    getSignedUrl(
      s3,
      new HeadObjectCommand({
        Bucket: convertedBucket,
        Key: convertedKey,
      }),
      { expiresIn: CONVERTED_TTL_SECONDS }
    ),
  ]);

  return jsonResponse(200, { uploadUrl, convertedUrl, pollUrl, uploadId });
};
