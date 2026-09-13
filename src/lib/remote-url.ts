import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type RemoteUrlInfo = {
  url: string;
  updatedAt: string;
};

function remoteFilePath() {
  return path.join(process.cwd(), ".shop-remote-url.json");
}

function parseRemote(raw: string): RemoteUrlInfo | null {
  try {
    const data = JSON.parse(raw) as Partial<RemoteUrlInfo>;
    if (typeof data.url === "string" && data.url.startsWith("http")) {
      return {
        url: data.url.replace(/\/$/, ""),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function getRemoteUrlInfoSync(): RemoteUrlInfo | null {
  try {
    return parseRemote(readFileSync(remoteFilePath(), "utf8"));
  } catch {
    return null;
  }
}

export async function getRemoteUrlInfo(): Promise<RemoteUrlInfo | null> {
  try {
    return parseRemote(await readFile(remoteFilePath(), "utf8"));
  } catch {
    return null;
  }
}

export async function getRemoteBaseUrl(): Promise<string | null> {
  return (await getRemoteUrlInfo())?.url ?? null;
}

export function getRemoteBaseUrlSync(): string | null {
  return getRemoteUrlInfoSync()?.url ?? null;
}

