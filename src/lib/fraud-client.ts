export type AnalyzeCollectRequest = {
  note: string;
  txn_type: string;
  scammer_id: string;
  tx_id?: string;
};

export type AnalyzeCollectResponse = {
  fraud: boolean;
  reasoning?: string;
  error?: string;
};

export type VerifyQrRequest = {
  merchant_id: string;
  amount: number;
  location: string;
  lat?: number;
  lng?: number;
  is_screen_shared?: boolean;
};

export type VerifyQrResponse = {
  swapped: boolean;
  distance: number;
  error?: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return data;
}

export function analyzeCollect(
  payload: AnalyzeCollectRequest,
): Promise<AnalyzeCollectResponse> {
  return postJson<AnalyzeCollectResponse>("/api/analyze-collect", payload);
}

export function verifyQr(payload: VerifyQrRequest): Promise<VerifyQrResponse> {
  return postJson<VerifyQrResponse>("/api/verify-qr", payload);
}
