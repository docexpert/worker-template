import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "put";

    // ✅ Get Authorization header
    const authHeader = request.headers.get("Authorization");

    // ✅ Check for Bearer token
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!filename) {
      return new Response("Missing ?filename=", { status: 400 });
    }

    // ✅ Set up S3/R2 client
    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    // ✅ Choose PUT or GET based on `action`
    const command = action === "get"
      ? new GetObjectCommand({ Bucket: "docexpert-docs", Key: filename })
      : new PutObjectCommand({ Bucket: "docexpert-docs", Key: filename, ContentType: "application/pdf" });

    // ✅ Generate signed URL (disable SHA256 enforcement for PUTs)
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn: 900,
      signingRegion: "auto",
      signingService: "s3",
      unsignableHeaders: new Set(["x-amz-content-sha256"])  // <-- this line is key!
    });

    return new Response(JSON.stringify({ url: signedUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
