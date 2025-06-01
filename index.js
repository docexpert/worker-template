import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "put";
    const fileUrl = url.searchParams.get("file_url");

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
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

    // If this is an upload (PUT), fetch the file and upload it directly
    if (action === "upload") {
      if (!fileUrl) {
        return new Response("Missing ?file_url=", { status: 400 });
      }

      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return new Response("Failed to fetch file from source", { status: 500 });
      }

      const fileBuffer = await fileResponse.arrayBuffer();

      const uploadCommand = new PutObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename,
        Body: fileBuffer,
        ContentType: "application/pdf",
      });

      await client.send(uploadCommand);

      return new Response(JSON.stringify({ status: "uploaded" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // For 'get' or 'put' signed URL
    const command = action === "get"
      ? new GetObjectCommand({ Bucket: "docexpert-docs", Key: filename })
      : new PutObjectCommand({ Bucket: "docexpert-docs", Key: filename, ContentType: "application/pdf" });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return new Response(JSON.stringify({ url: signedUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
