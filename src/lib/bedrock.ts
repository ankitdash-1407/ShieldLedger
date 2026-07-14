import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const CLAUDE_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0";
const TITAN_EMBED_MODEL_ID = "amazon.titan-embed-text-v1";

const FRAUD_SYSTEM_PROMPT =
  'You are a financial fraud detection kernel. Analyze the transaction note text and transaction type. If the text strongly implies a credit/refund/receiving money (e.g., \'OLX advance refund\', \'Receive cash back\', \'Prize money\') but the transaction type is strictly \'DEBIT\', flag this as a \'Fake Collect Request\' scam. Return a clean JSON object: { "fraud": true, "reasoning": "Reason here" }. Otherwise return { "fraud": false }.';

let bedrockClient: BedrockRuntimeClient | undefined;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const region = process.env.AWS_REGION ?? "us-east-1";
    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return bedrockClient;
}

export type FraudAnalysisResult = {
  fraud: boolean;
  reasoning?: string;
};

function extractJsonObject(text: string): FraudAnalysisResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? candidate) as FraudAnalysisResult;
  return parsed;
}

export async function detectFraud(
  note: string,
  txnType: string,
): Promise<FraudAnalysisResult> {
  const client = getBedrockClient();

  const response = await client.send(
    new ConverseCommand({
      modelId: CLAUDE_MODEL_ID,
      system: [{ text: FRAUD_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Transaction note: ${note}\nTransaction type: ${txnType}`,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0,
      },
    }),
  );

  const text =
    response.output?.message?.content?.[0]?.text?.trim() ?? '{"fraud": false}';

  try {
    const parsed = extractJsonObject(text);
    return {
      fraud: parsed.fraud === true,
      reasoning: parsed.reasoning,
    };
  } catch {
    return { fraud: false, reasoning: "Unable to parse Bedrock response" };
  }
}

export async function embedContext(context: string): Promise<number[]> {
  const client = getBedrockClient();

  const response = await client.send(
    new InvokeModelCommand({
      modelId: TITAN_EMBED_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: context,
      }),
    }),
  );

  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding?: number[];
  };

  if (!body.embedding?.length) {
    throw new Error("Titan embedding model returned an empty vector");
  }

  return body.embedding;
}
