import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

let _client = null;
let _signerUuid = null;
let _enabled = false;

export function initSocial(apiKey, signerUuid) {
  if (!apiKey || !signerUuid) {
    console.warn("Farcaster not configured");
    return;
  }
  _client = new NeynarAPIClient(new Configuration({ apiKey }));
  _signerUuid = signerUuid;
  _enabled = true;
}

/** Post to Farcaster */
export async function postCast(text) {
  if (!_enabled) {
    console.log("\n📢 [Would post to Farcaster]:\n" + text + "\n");
    return null;
  }

  try {
    if (text.length <= 320) {
      const res = await _client.publishCast({ signerUuid: _signerUuid, text });
      return res.cast.hash;
    }

    // Thread long posts
    const chunks = chunkText(text, 300);
    let parentHash = null;
    let firstHash = null;

    for (const chunk of chunks) {
      const payload = { signerUuid: _signerUuid, text: chunk };
      if (parentHash) payload.parent = parentHash;
      const res = await _client.publishCast(payload);
      parentHash = res.cast.hash;
      if (!firstHash) firstHash = parentHash;
    }
    return firstHash;
  } catch (err) {
    console.error("Farcaster post failed:", err.message);
    return null;
  }
}

function chunkText(text, maxLen) {
  const words = text.split(" ");
  const chunks = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
