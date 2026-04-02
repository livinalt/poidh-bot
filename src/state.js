import fs from "fs/promises";
import path from "path";

const STATE_FILE = path.resolve("./bot-state.json");

const DEFAULTS = {
  phase: "idle",
  network: null,
  bountyId: null,
  bountyName: null,
  bountyDescription: null,
  bountyUrl: null,
  createdAt: null,
  evaluations: {},
  winner: null,
  logs: [],
};

export async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function addLog(state, message) {
  const entry = { ts: new Date().toISOString(), message };
  state.logs = [...(state.logs ?? []).slice(-99), entry];
  await saveState(state);
}
