import net from "net";
import os from "os";
import { spawn } from "child_process";
import { existsSync } from "fs";

const NC_BIN = "/usr/bin/nc";

/** macOS のローカルネットワーク制限で node 直結が拒否された場合の nc フォールバック */
function probeViaNc(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
    const child = spawn(NC_BIN, ["-z", "-G", String(secs), ip, String(port)], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(false);
    }, timeoutMs + 1500);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

function probeDirect(ip: string, port: number, timeoutMs: number): Promise<{ ok: boolean; denied: boolean }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean, denied = false) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, denied });
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      done(true);
    });
    socket.once("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      done(false, err.code === "EHOSTUNREACH" || err.code === "ENETUNREACH" || err.code === "EPERM");
    });
    socket.connect(port, ip);
  });
}

export async function probePrinter(ip: string, port: number, timeoutMs = 800): Promise<boolean> {
  const direct = await probeDirect(ip, port, timeoutMs);
  if (direct.ok) return true;
  if (direct.denied && process.platform === "darwin" && existsSync(NC_BIN)) {
    return probeViaNc(ip, port, Math.max(timeoutMs, 1500));
  }
  return false;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

function intToIpv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function listLanHosts(limit = 254): { selfIp: string; hosts: string[] } | null {
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const netInfo of addrs ?? []) {
      if (netInfo.family !== "IPv4" || netInfo.internal) continue;
      const ip = netInfo.address;
      const mask = netInfo.netmask;
      if (!ip || !mask) continue;
      const ipInt = ipv4ToInt(ip);
      const maskInt = ipv4ToInt(mask);
      const network = ipInt & maskInt;
      const broadcast = network | (~maskInt >>> 0);
      const hosts: string[] = [];
      for (let n = network + 1; n < broadcast && hosts.length < limit; n++) {
        const candidate = intToIpv4(n);
        if (candidate !== ip) hosts.push(candidate);
      }
      return { selfIp: ip, hosts };
    }
  }
  return null;
}

export async function discoverEscPosPrinters(port = 9100): Promise<{
  selfIp: string | null;
  printers: { ip: string; port: number }[];
}> {
  const lan = listLanHosts();
  if (!lan) return { selfIp: null, printers: [] };

  const concurrency = 48;
  const printers: { ip: string; port: number }[] = [];
  for (let i = 0; i < lan.hosts.length; i += concurrency) {
    const batch = lan.hosts.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((ip) => probePrinter(ip, port, 350)));
    results.forEach((ok, idx) => {
      const ip = batch[idx];
      if (ok && ip) printers.push({ ip, port });
    });
  }
  return { selfIp: lan.selfIp, printers };
}
