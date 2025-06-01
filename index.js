import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "upload";
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

    if (action === "upload") {
      const fileBuffer = await request.arrayBuffer();
      const putCommand = new PutObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename,
        Body: fileBuffer,
        ContentType: "application/pdf",
      });

      await client.send(putCommand);
      return new Response(JSON.stringify({ status: "Uploaded" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const getCommand = new GetObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename,
      });

      const url = await getSignedUrl(client, getCommand, { expiresIn: 900 });
      return new Response(JSON.stringify({ url }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Invalid action", { status: 400 });
  }
};
