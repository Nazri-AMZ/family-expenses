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

// Models to try in order of preference
const MODEL_FALLBACK_LIST = [
  "gemini-2.5-flash",
  "gemini-3-flash",
  "gemini-2.5-flash-lite",
];

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

  try {
    const { receiptId, imageUrl } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("receipts").update({ status: "processing" }).eq(
      "id",
      receiptId,
    );

    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = arrayBufferToBase64(imageBuffer);
    const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    let rawText = "";
    let lastError = null;

    // --- 🚀 FALLBACK LOGIC START ---
    for (const modelName of MODEL_FALLBACK_LIST) {
      console.log(`Attempting OCR with: ${modelName}`);
      const geminiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        break; // Success! Exit the loop.
      } else {
        const errBody = await geminiResponse.json().catch(() => ({}));
        lastError = errBody;

        // If it's a 429 (Rate Limit), we continue to the next model
        if (geminiResponse.status === 429) {
          console.warn(`Rate limit hit for ${modelName}. Trying next...`);
          continue;
        } else {
          // If it's a different error (e.g., 400, 500), stop and throw
          throw new Error(
            `Gemini API error ${geminiResponse.status}: ${
              JSON.stringify(errBody)
            }`,
          );
        }
      }
    }
    // --- 🚀 FALLBACK LOGIC END ---

    if (!rawText) {
      throw new Error("Gemini returned empty response");
    }

    // Parse Gemini response
    let parsed: any = null;
    try {
      // JSON mode returns a clean string
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", rawText);
      throw new Error("Failed to parse AI response");
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
        receipt_id: receiptId,
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
