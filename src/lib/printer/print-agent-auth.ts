import { timingSafeEqual } from "crypto";

/** 印刷エージェント認証。PRINT_AGENT_KEY と一致する x-print-agent-key ヘッダが必要 */
export function isPrintAgentAuthorized(request: Request): boolean {
  const expected = process.env.PRINT_AGENT_KEY ?? "";
  if (!expected) return false;
  const given = request.headers.get("x-print-agent-key") ?? "";
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
