import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

let DATA_DIR = join(process.cwd(), "data");
let DATA_FILE = join(DATA_DIR, "data.json");

export function setStorageRoot(root: string): void {
  DATA_DIR = join(root, "data");
  DATA_FILE = join(DATA_DIR, "data.json");
}

export interface Recipient {
  id: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
  name: string;
  surname: string;
  fullAddress: string;
}

export interface ItemTemplate {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  VATRate: number;
}

export interface StorageData {
  recipients: Recipient[];
  items: ItemTemplate[];
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadData(): StorageData {
  ensureDir();
  if (!existsSync(DATA_FILE)) {
    return { recipients: [], items: [] };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

export function saveData(data: StorageData): void {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
