import { execSync } from "node:child_process";

export function resolvePublicIp(hostname) {
  const resolvers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"];
  for (const resolver of resolvers) {
    try {
      const out = execSync(`dig @${resolver} +short ${hostname}`, {
        encoding: "utf8",
        timeout: 10_000,
      });
      const ip = out
        .trim()
        .split("\n")
        .find((line) => /^\d/.test(line));
      if (ip) return ip;
    } catch {
      // try next resolver
    }
  }
  return null;
}

export function checkPublicUrl(url, path = "/waiter/tables") {
  const target = new URL(path, url).toString();
  const hostname = new URL(target).hostname;
  const ip = resolvePublicIp(hostname);
  if (!ip) return false;

  try {
    const code = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time 20 --resolve ${hostname}:443:${ip} ${JSON.stringify(target)}`,
      { encoding: "utf8", timeout: 25_000 },
    ).trim();
    return code === "200";
  } catch {
    return false;
  }
}
