import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const fileUrl = url.searchParams.get("file_url");
    const authHeader = request.headers.get("Authorization");

    // Auth
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!filename || !fileUrl) {
      return new Response("Missing required parameters", { status: 400 });
    }

    // Fetch file from PDF.co signed URL
    let fileResponse;
    try {
      fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return new Response(`Failed to fetch file from source: ${fileResponse.status} - ${await fileResponse.text()}`, { status: 500 });
      }
    } catch (err) {
      return new Response(`Fetch error: ${err}`, { status: 500 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();

    // Upload to R2
    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    const command = new PutObjectCommand({
      Bucket: "docexpert-docs",
      Key: filename,
      Body: fileBuffer,
      ContentType: "application/pdf"
    });

    try {
      await client.send(command);
      return new Response(JSON.stringify({ success: true, filename }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(`Upload to R2 failed: ${err}`, { status: 500 });
    }
  }
};
