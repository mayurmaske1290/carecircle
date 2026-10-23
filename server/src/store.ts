import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { emptyStore, type Store } from "./domain.js";

const dataPath = resolve(process.cwd(), process.env.DATA_FILE || "./data/carecircle.json");
let state: Store = emptyStore();
let writeChain: Promise<void> = Promise.resolve();
export async function loadStore(): Promise<void> {
  try {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (Array.isArray(parsed.members) && Array.isArray(parsed.tasks)) state = parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not load data file; using fresh demo data.", e);
    await persist();
  }
}
async function persist(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  writeChain = writeChain.then(async () => {
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, snapshot, "utf8");
  });
  return writeChain;
}
export function getStore(): Store { return structuredClone(state); }
export async function updateStore(mutator: (draft: Store) => Store): Promise<Store> {
  const draft = structuredClone(state);
  state = mutator(draft);
  await persist();
  return getStore();
}
export async function resetStore(): Promise<Store> {
  state = emptyStore();
  await persist();
  return getStore();
}
