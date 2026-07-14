import { detectFraud, embedContext } from "./bedrock";
import { getPool } from "./db";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export async function handleAnalyzeCollect(request: Request): Promise<Response> {
  try {
    let body: { note?: string; txn_type?: string; scammer_id?: string };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { note, txn_type, scammer_id } = body;

    if (!note || !txn_type || !scammer_id) {
      return errorResponse("note, txn_type, and scammer_id are required", 400);
    }

    const analysis = await detectFraud(note, txn_type);

    if (analysis.fraud) {
      await getPool().query(
        "UPDATE accounts SET is_locked = true WHERE account_id = $1",
        [scammer_id],
      );
    }

    return jsonResponse({
      fraud: analysis.fraud,
      ...(analysis.reasoning ? { reasoning: analysis.reasoning } : {}),
    });
  } catch (error) {
    console.error("analyze-collect error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze collect request";
    return errorResponse(message, 500);
  }
}

export async function handleVerifyQr(request: Request): Promise<Response> {
  try {
    let body: { merchant_id?: string; amount?: number; location?: string };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { merchant_id, amount, location } = body;

    if (!merchant_id || amount == null || !location) {
      return errorResponse("merchant_id, amount, and location are required", 400);
    }

    const context = `${amount} ${location}`;
    const embedding = await embedContext(context);
    const embeddingLiteral = `[${embedding.join(",")}]`;

    const result = await getPool().query<{
      merchant_id: string;
      distance: number;
    }>(
      `SELECT merchant_id, (behavior_embedding <-> $1::vector) AS distance
       FROM merchant_profiles
       WHERE merchant_id = $2
       LIMIT 1`,
      [embeddingLiteral, merchant_id],
    );

    if (result.rowCount === 0) {
      return errorResponse("Merchant profile not found", 404);
    }

    const distance = Number(result.rows[0].distance);
    const swapped = distance > 0.5;

    return jsonResponse({ swapped, distance });
  } catch (error) {
    console.error("verify-qr error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to verify QR transaction";
    return errorResponse(message, 500);
  }
}
