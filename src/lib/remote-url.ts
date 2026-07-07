import { readFile } from "node:fs/promises";
import path from "node:path";

export type RemoteUrlInfo = {
  url: string;
  updatedAt: string;
};

export async function getRemoteBaseUrl(): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), ".shop-remote-url.json");
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw) as Partial<RemoteUrlInfo>;
    if (typeof data.url === "string" && data.url.startsWith("http")) {
      return data.url.replace(/\/$/, "");
    }
  } catch {
    // no tunnel yet
  }
  return null;
}

export async function getRemoteUrlInfo(): Promise<RemoteUrlInfo | null> {
  try {
    const file = path.join(process.cwd(), ".shop-remote-url.json");
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw) as Partial<RemoteUrlInfo>;
    if (typeof data.url === "string" && data.url.startsWith("http")) {
      return {
        url: data.url.replace(/\/$/, ""),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      };
    }
  } catch {
    // no tunnel yet
  }
  return null;
}
