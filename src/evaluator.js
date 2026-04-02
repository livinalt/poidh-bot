import { GoogleGenerativeAI } from "@google/generative-ai";

let _model = null;

export function initAI(apiKey) {
  const client = new GoogleGenerativeAI(apiKey);
  _model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
}

const SYSTEM_PROMPT = `You are the autonomous judging AI for a poidh bounty platform.
Evaluate whether a photo submission genuinely fulfills a real-world bounty task.

Respond ONLY with valid JSON - no markdown, no text outside the JSON object.

Required shape:
{
  "score": <number 0.0-10.0>,
  "authenticity": <number 0.0-10.0>,
  "taskCompletion": <number 0.0-10.0>,
  "creativity": <number 0.0-10.0>,
  "evidenceQuality": <number 0.0-10.0>,
  "reasoning": "<paragraph explaining your decision>",
  "summary": "<one sentence verdict>"
}

Scoring:
- 0-3: Fake, AI-generated, stock photo, off-topic, or no image
- 4-5: Partially meets criteria, missing key proof
- 6-7: Clearly fulfills the task with solid evidence
- 8-9: Strong, authentic, well-documented real-world action
- 10:  Exceptional - creative, genuine, undeniable proof

Be skeptical of AI-generated images (distorted hands, unnatural lighting, too-perfect detail).
Be skeptical of stock photos (watermarks, overly generic settings, no personal context).
Reward genuine human presence, natural environments, real contextual details.`;

async function fetchImage(uri) {
  if (!uri) return null;

  let url = uri;
  if (uri.startsWith("ipfs://")) url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  else if (uri.startsWith("ar://")) url = `https://arweave.net/${uri.slice(5)}`;

  const tryFetch = async (fetchUrl) => {
    const resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(20000) });
    const ct = resp.headers.get("content-type") ?? "";

    if (ct.includes("json") || ct.includes("text/plain")) {
      const meta = await resp.json();
      return meta.image ? fetchImage(meta.image) : null;
    }

    if (ct.startsWith("image/")) {
      const buf = Buffer.from(await resp.arrayBuffer());
      return { base64: buf.toString("base64"), mediaType: ct.split(";")[0] };
    }
    return null;
  };

  try {
    return await tryFetch(url);
  } catch {
    if (uri.startsWith("ipfs://")) {
      try {
        return await tryFetch(`https://cloudflare-ipfs.com/ipfs/${uri.slice(7)}`);
      } catch {}
    }
  }
  return null;
}

export async function evaluateClaim(claim, bountyDescription) {
  const { id, issuer, name, description, uri } = claim;
  const imageData = await fetchImage(uri);
  const hasImage = !!imageData;

  const parts = [];

  parts.push({
    text: `${SYSTEM_PROMPT}

BOUNTY TASK:
${bountyDescription}

SUBMISSION:
- Claim ID: ${id}
- Submitter: ${issuer}
- Title: ${name}
- Description: ${description || "(none)"}
- Media URI: ${uri || "(none)"}
${!hasImage ? "\nWARNING: Image could not be fetched - score accordingly (likely 0-3)." : ""}

Return ONLY the JSON evaluation object.`,
  });

  if (hasImage) {
    parts.push({
      inlineData: {
        mimeType: imageData.mediaType,
        data: imageData.base64,
      },
    });
  }

  try {
    const result = await _model.generateContent(parts);
    const raw = result.response.text().trim();

    // Strip markdown fences if Gemini wraps response in them
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (typeof parsed.score !== "number") throw new Error("Bad response shape");

    return {
      ...parsed,
      claimId: id.toString(),
      issuer,
      name,
      uri,
      imageLoaded: hasImage,
      evaluatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      score: 0, authenticity: 0, taskCompletion: 0, creativity: 0, evidenceQuality: 0,
      reasoning: `Evaluation error: ${err.message}`,
      summary: "Error during evaluation - scored 0",
      claimId: id.toString(),
      issuer, name, uri,
      imageLoaded: hasImage,
      evaluatedAt: new Date().toISOString(),
      error: true,
    };
  }
}