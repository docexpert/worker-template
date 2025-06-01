import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const authHeader = request.headers.get("Authorization");

    // ✅ Require Authorization token
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // ✅ Require filename
    if (!filename) {
      return new Response("Missing ?filename= parameter", { status: 400 });
    }

    // ✅ Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ✅ Get binary body (PDF file)
    const fileBuffer = await request.arrayBuffer();

    // ✅ Initialize R2 client
    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    // ✅ Create and send upload command
    const command = new PutObjectCommand({
      Bucket: "docexpert-docs",
      Key: filename,
      Body: fileBuffer,
      ContentType: "application/pdf",
    });

    try {
      await client.send(command);
      return new Response(JSON.stringify({ success: true, filename }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(`Failed to upload to R2: ${err}`, { status: 500 });
    }
  }
};
