import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename");
    const action = url.searchParams.get("action") || "put";
    const fileUrl = url.searchParams.get("file_url");

    // ✅ Authorization
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!filename) {
      return new Response("Missing ?filename=", { status: 400 });
    }

    // ✅ Setup R2 client
    const client = new S3Client({
      region: "auto",
      endpoint: "https://72916a6493777ed93342623a8ac89a09.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    });

    // ✅ Upload mode (fetch from file_url and upload to R2)
    if (action === "upload") {
      if (!fileUrl) {
        return new Response("Missing ?file_url=", { status: 400 });
      }

      try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          const text = await fileResponse.text();
          return new Response(`Failed to fetch file from source: ${fileResponse.status} - ${text}`, { status: 500 });
        }

        const buffer = await fileResponse.arrayBuffer();
        await client.send(new PutObjectCommand({
          Bucket: "docexpert-docs",
          Key: filename,
          Body: buffer,
          ContentType: "application/pdf"
        }));

        return new Response(JSON.stringify({ success: true, uploaded: filename }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(`Upload failed: ${err.message}`, { status: 500 });
      }
    }

    // ✅ Signed URL for GET or PUT
    const command = action === "get"
      ? new GetObjectCommand({ Bucket: "docexpert-docs", Key: filename })
      : new PutObjectCommand({ Bucket: "docexpert-docs", Key: filename, ContentType: "application/pdf" });

    try {
      const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
      return new Response(JSON.stringify({ url: signedUrl }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(`Failed to generate signed URL: ${err.message}`, { status: 500 });
    }
  }
};
