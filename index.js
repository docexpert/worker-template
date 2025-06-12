import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const fileUrl = url.searchParams.get("file_url"); // Only needed for PUT
    const action = url.searchParams.get("action") || "put";
    const authHeader = request.headers.get("Authorization");

    // 🔐 Require Authorization for put/get actions, allow proxy to be public
    if (action !== "proxy") {
      if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
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

    // Proxy mode: stream PDF for PDF.js with CORS headers
    if (action === "proxy") {
      try {
        const command = new GetObjectCommand({
          Bucket: "docexpert-docs",
          Key: filename
        });

        const response = await client.send(command);
        const stream = response.Body;

        return new Response(stream, {
          headers: {
            "Content-Type": "application/pdf",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          }
        });
      } catch (err) {
        return new Response(`Failed to proxy PDF: ${err}`, { status: 500 });
      }
    }

    // Get mode: return signed URL
    if (action === "get") {
      try {
        const command = new GetObjectCommand({
          Bucket: "docexpert-docs",
          Key: filename
        });

        const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
        return new Response(JSON.stringify({ success: true, url: signedUrl }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(`Failed to generate signed URL: ${err}`, { status: 500 });
      }
    }

    // Put mode: upload file from external URL
    if (!fileUrl) {
      return new Response("Missing required parameter: file_url", { status: 400 });
    }

    let fileResponse;
    try {
      fileResponse = await fetch(fileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/pdf",
          "Referer": "https://pdf.co"  // Optional: still useful for Bubble-hosted URLs
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

    try {
      const putCommand = new PutObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename,
        Body: fileBuffer,
        ContentType: "application/pdf"
      });

      await client.send(putCommand);

      const getCommand = new GetObjectCommand({
        Bucket: "docexpert-docs",
        Key: filename
      });

      const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 900 });

      return new Response(JSON.stringify({
        success: true,
        filename,
        url: signedUrl
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(`Upload to R2 failed: ${err}`, { status: 500 });
    }
  }
};
