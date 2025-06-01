import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const fileUrl = url.searchParams.get("file_url"); // Only required for PUT
    const action = url.searchParams.get("action") || "put";
    const authHeader = request.headers.get("Authorization");

    // 🔐 Auth
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!filename) {
      return new Response("Missing required parameter: filename", { status: 400 });
    }

    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    if (action === "get") {
      // 🎯 Generate a signed URL for downloading the file
      const command = new GetObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename
      });

      try {
        const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
        return new Response(JSON.stringify({ url: signedUrl }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(`Failed to generate signed URL: ${err}`, { status: 500 });
      }
    }

    // 📨 PUT: Upload file to R2 from `file_url`
    if (!fileUrl) {
      return new Response("Missing required parameter: file_url", { status: 400 });
    }

    let fileResponse;
    try {
      fileResponse = await fetch(fileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/pdf",
          "Referer": "https://pdf.co" // Optional, helps with referer checks
        }
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        return new Response(`Failed to fetch file from source: ${fileResponse.status} - ${errorText}`, { status: 500 });
      }
    } catch (err) {
      return new Response(`Fetch error: ${err.message || err}`, { status: 500 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();

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
