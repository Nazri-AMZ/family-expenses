import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

export interface ParsedReceipt {
  receipt_id: string; // Add this
  merchant: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  currency: string | null;
  line_items: { name: string; amount: number; quantity: number }[] | null;
  suggested_category: string | null;
  category_id: string | null;
}
/**
 * Upload a receipt image and trigger AI processing via Edge Function.
 * Returns the parsed receipt data to pre-fill the expense form.
 */
export async function processReceiptImage(
  imageUri: string,
  familyId: string,
  userId: string,
): Promise<ParsedReceipt> {
  // 1. Get current session for auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  // 2. Upload image using FormData (works with local file:// URIs on React Native)
  console.log("Optimizing image size...");
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1024 } }], // Resizing to 1024px width (keeps aspect ratio)
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }, // 70% quality is plenty for OCR
  );
  const optimizedUri = manipulatedImage.uri;
  // --- 🚀 OPTIMIZATION END ---

  const fileName = `${userId}/${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append("file", {
    uri: optimizedUri, // Use the new optimized URI here
    name: "receipt.jpg",
    type: "image/jpeg",
  } as any);

  const uploadResponse = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/receipts/${fileName}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      body: formData,
    },
  );

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    throw new Error(`Upload failed: ${err}`);
  }

  // 3. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("receipts")
    .getPublicUrl(fileName);

  // 4. Create receipt record in DB with status: pending
  const { data: receipt, error: insertError } = await supabase
    .from("receipts")
    .insert({
      family_id: familyId,
      uploaded_by: userId,
      storage_path: fileName,
      public_url: publicUrl,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !receipt) {
    throw new Error(`DB insert failed: ${insertError?.message}`);
  }

  // 5. Invoke Edge Function — Gemini processes the image
  const { data: { session: currentSession } } = await supabase.auth
    .getSession();

  const fnResponse = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-receipt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.EXPO_PUBLIC_SUPABASE_KEY!,
      },
      body: JSON.stringify({
        receiptId: receipt.id,
        imageUrl: publicUrl,
      }),
    },
  );

  const fnText = await fnResponse.text();
  console.log("Edge function raw response:", fnText); // ← This will show the exact error

  if (!fnResponse.ok) throw new Error(`Edge Function failed: ${fnText}`);

  const parsed = JSON.parse(fnText);

  return parsed as ParsedReceipt;
}

/**
 * Poll receipt status until done or failed.
 * Useful if you want to process async and poll instead of waiting.
 */
export async function pollReceiptStatus(
  receiptId: string,
  maxAttempts = 10,
  intervalMs = 2000,
): Promise<"done" | "failed"> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const { data } = await supabase
      .from("receipts")
      .select("status")
      .eq("id", receiptId)
      .single();

    if (data?.status === "done") return "done";
    if (data?.status === "failed") return "failed";
  }
  return "failed";
}
