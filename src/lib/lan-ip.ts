import os from "os";

/** 同一LAN内のiPhoneから接続するためのIPv4アドレス */
export function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith("lo")) continue;
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

export function buildLanBaseUrl(port: number, lanIp?: string | null): string | null {
  const ip = lanIp ?? getLanIp();
  if (!ip) return null;
  return `http://${ip}:${port}`;
}
