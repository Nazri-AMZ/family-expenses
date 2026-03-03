import { createClient } from "@supabase/supabase-js";
import { serve } from "std/http/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  `You are a receipt parser. Given a receipt image, extract the following and return ONLY valid JSON, no markdown, no explanation:

{
  "merchant": "store name",
  "total_amount": 0.00,
  "receipt_date": "YYYY-MM-DD",
  "currency": "MYR",
  "line_items": [
    { "name": "item name", "amount": 0.00, "quantity": 1 }
  ],
  "suggested_category": "one of: Groceries, Dining, Utilities, Transport, Health, Education, Shopping, Entertainment, Travel, Others"
}

Rules:
- total_amount should be the final total (after tax/discounts)
- receipt_date: use today's date if not visible
- currency: default to MYR if in Malaysia, otherwise detect from receipt
- suggested_category: pick the single best category based on the merchant/items
- If you cannot read the receipt clearly, still return the JSON with null for fields you cannot determine`;

// ✅ Chunked base64 conversion — avoids stack overflow on large images
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Function booted");

  try {
    const { receiptId, imageUrl } = await req.json();
    console.log("Received:", { receiptId, imageUrl });

    if (!receiptId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: "receiptId and imageUrl are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Mark receipt as processing
    await supabase
      .from("receipts")
      .update({ status: "processing" })
      .eq("id", receiptId);

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    // Fetch image and convert to base64 safely
    console.log("Fetching image:", imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log("Image size:", imageBuffer.byteLength, "bytes");

    const base64Image = arrayBufferToBase64(imageBuffer); // ✅ safe chunked conversion
    const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    console.log("Base64 length:", base64Image.length, "mime:", mimeType);

    // Call Gemini Vision
    console.log("Calling Gemini...");
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error ${geminiResponse.status}: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    console.log("Gemini raw response:", rawText);

    if (!rawText) {
      throw new Error("Gemini returned empty response");
    }

    // Parse Gemini response
    let parsed: any = null;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Gemini returned invalid JSON: " + rawText);
    }

    // Map category name to category_id
    let categoryId: string | null = null;
    if (parsed.suggested_category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("name", parsed.suggested_category)
        .is("family_id", null)
        .single();

      categoryId = cat?.id ?? null;
    }

    // Update receipt record
    await supabase
      .from("receipts")
      .update({
        status: "done",
        ai_raw_response: { raw: rawText },
        ai_parsed: parsed,
        merchant: parsed.merchant ?? null,
        total_amount: parsed.total_amount ?? null,
        receipt_date: parsed.receipt_date ?? null,
        line_items: parsed.line_items ?? null,
      })
      .eq("id", receiptId);

    console.log("Done! Returning parsed data:", parsed);

    return new Response(
      JSON.stringify({
        merchant: parsed.merchant,
        total_amount: parsed.total_amount,
        receipt_date: parsed.receipt_date,
        currency: parsed.currency,
        line_items: parsed.line_items,
        suggested_category: parsed.suggested_category,
        category_id: categoryId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("process-receipt error:", String(error));

    try {
      const body = await req.clone().json().catch(() => ({}));
      const receiptId = (body as any).receiptId;
      if (receiptId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("receipts").update({ status: "failed" }).eq(
          "id",
          receiptId,
        );
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
