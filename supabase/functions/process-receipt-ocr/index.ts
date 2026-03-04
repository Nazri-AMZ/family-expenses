import { createClient } from "@supabase/supabase-js";
import { serve } from "std/http/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  `You are a receipt parser. Given OCR text from a receipt, extract and return ONLY valid JSON:

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
- total_amount = final amount
- receipt_date: today if missing
- currency default MYR
- Return null if unsure
- No markdown code blocks
- No explanation
- IMPORTANT: Ensure the output is a single line of valid JSON without literal newlines inside string values.`;

const MODEL = "gemini-2.5-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let currentReceiptId: string | null = null;

  try {
    const { receiptId, imageUrl } = await req.json();
    currentReceiptId = receiptId;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase
      .from("receipts")
      .update({ status: "processing" })
      .eq("id", receiptId);

    /* --------------------
       Download Image
    ---------------------*/
    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const mime = imgRes.headers.get("content-type") ?? "image/jpeg";

    /* --------------------
       Call OCR Server (Node.js Railway)
    ---------------------*/
    const ocrUrl = Deno.env.get("OCR_SERVER_URL")!;
    const form = new FormData();
    form.append("file", new Blob([imgBuffer], { type: mime }), "receipt.jpg");

    const ocrRes = await fetch(ocrUrl, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });

    const ocrBody = await ocrRes.text();

    if (!ocrRes.ok) {
      throw new Error(
        `OCR server failed (${ocrRes.status}): ${ocrBody.slice(0, 100)}`,
      );
    }

    const sanitizedOcrBody = ocrBody.replace(/[\n\r]/g, " ").trim();
    const ocrData = JSON.parse(sanitizedOcrBody);
    const { text: ocrText, confidence } = ocrData;

    const safeOcrText = ocrText.replace(/[^\x20-\x7E]/g, " ").trim();

    console.log("Safe OCR text:", safeOcrText);
    console.log("OCR confidence:", confidence);

    if (!safeOcrText || safeOcrText.length < 5) {
      throw new Error("OCR failed to extract readable text");
    }

    /* --------------------
       Send Text to Gemini
    ---------------------*/
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `OCR TEXT:\n${safeOcrText}` },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) throw new Error("Gemini returned an empty response");

    let cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    cleaned = cleaned.replace(/\n/g, " ").replace(/\r/g, "");

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{.*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error("Gemini parse failed. Raw text:", raw);
        throw new Error(
          `JSON Syntax Error: ${e instanceof Error ? e.message : "Unknown"}`,
        );
      }
    }

    /* --------------------
       Lookup Category ID
    ---------------------*/
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

    /* --------------------
       Save Result
    ---------------------*/
    await supabase
      .from("receipts")
      .update({
        status: "done",
        ai_raw_response: { raw },
        ai_parsed: parsed,
        merchant: parsed.merchant,
        total_amount: parsed.total_amount,
        receipt_date: parsed.receipt_date,
        line_items: parsed.line_items,
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
        category_id: categoryId, // ← real UUID now
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Edge Function Error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (currentReceiptId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("receipts").update({ status: "failed" }).eq(
        "id",
        currentReceiptId,
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
