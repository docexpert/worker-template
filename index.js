import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "put";
    const token = url.searchParams.get("token");

    // ✅ Token check
    if (token !== env.AUTH_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!filename) {
      return new Response("Missing ?filename=", { status: 400 });
    }

    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    const command = action === "get"
      ? new GetObjectCommand({ Bucket: "docexpert-docs", Key: filename })
      : new PutObjectCommand({ Bucket: "docexpert-docs", Key: filename, ContentType: "application/pdf" });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return new Response(JSON.stringify({ url: signedUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
