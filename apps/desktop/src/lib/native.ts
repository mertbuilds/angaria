import { invoke } from "@tauri-apps/api/core";

export const secretSet = (key: string, value: string) => invoke<void>("secret_set", { key, value });
export const secretGet = (key: string) => invoke<string | null>("secret_get", { key });
export const secretDelete = (key: string) => invoke<void>("secret_delete", { key });
