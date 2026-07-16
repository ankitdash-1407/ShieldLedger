import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type FraudAnalysisResult = {
  fraud: boolean;
  reasoning?: string;
};

export async function detectFraud(
  note: string,
  txnType: string,
): Promise<FraudAnalysisResult> {
  const prompt = `Analyze this transaction for fraud. 
Note: ${note}
Type: ${txnType}

System Rules: If the text strongly implies a credit/refund/receiving money (e.g., 'OLX advance refund', 'Receive cash back', 'Prize money') but the transaction type is strictly 'DEBIT', flag this as a 'Fake Collect Request' scam.

Respond ONLY with a raw JSON object matching this structure: { "fraud": true, "reasoning": "Reason here" } or { "fraud": false }.`;

  // Simplified payload to guarantee zero 400 errors
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant", // The rock-solid 2026 standard
      messages: [
        { role: "system", content: "You are a JSON-only fraud detection AI. Output strictly valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API crashed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as FraudAnalysisResult;
    return {
      fraud: parsed.fraud === true,
      reasoning: parsed.reasoning,
    };
  } catch {
    return { fraud: false, reasoning: "Parse failed" };
  }
}

export async function embedContext(context: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-2", 
    contents: context,
  });
  
  if (!result.embeddings?.[0]?.values) {
    throw new Error("Gemini embedding model returned an empty vector");
  }
  
  return result.embeddings[0].values;
}