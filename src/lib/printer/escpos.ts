import iconv from "iconv-lite";

/**
 * ESC/POS コマンドビルダー（Epson TM-m30 系向け）
 * 日本語は Shift_JIS (cp932) で送信する。
 */
export class EscPosBuilder {
  private chunks: Buffer[] = [];

  /** プリンター初期化 + 漢字モード(Shift_JIS) + 日本文字セット */
  init(): this {
    this.raw([0x1b, 0x40]); // ESC @
    this.raw([0x1b, 0x52, 0x08]); // ESC R 8 = 日本（0x5C を ¥ で印字）
    this.raw([0x1c, 0x26]); // FS & 漢字モード
    this.raw([0x1c, 0x43, 0x01]); // FS C 1 = Shift_JIS
    return this;
  }

  raw(bytes: number[] | Buffer): this {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  text(str: string): this {
    this.chunks.push(iconv.encode(str, "cp932"));
    return this;
  }

  line(str = ""): this {
    return this.text(str + "\n");
  }

  /** 0=左 1=中央 2=右 */
  align(n: 0 | 1 | 2): this {
    return this.raw([0x1b, 0x61, n]);
  }

  /** 文字サイズ: 幅倍率/高さ倍率 (1-8) */
  size(width: number, height: number): this {
    const n = ((width - 1) << 4) | (height - 1);
    return this.raw([0x1d, 0x21, n]);
  }

  bold(on: boolean): this {
    return this.raw([0x1b, 0x45, on ? 1 : 0]);
  }

  feed(lines = 1): this {
    return this.raw([0x1b, 0x64, lines]); // ESC d n
  }

  /** パーシャルカット（フィード付き） */
  cut(): this {
    return this.raw([0x1d, 0x56, 0x42, 0x10]);
  }

  /** 白黒反転（再発行バーなど） */
  reverse(on: boolean): this {
    return this.raw([0x1d, 0x42, on ? 1 : 0]);
  }

  /**
   * QRコード（Model 2）。データは UTF-8。
   * moduleSize: 1–16（80mm紙なら 6〜8 が見やすい）
   */
  qr(data: string, moduleSize = 6): this {
    const payload = Buffer.from(data, "utf8");
    const storeLen = payload.length + 3;
    this.raw([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, moduleSize))]);
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]);
    this.raw([0x1d, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30]);
    this.raw(payload);
    this.raw([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    return this;
  }

  /** キャッシュドロワーキック（ピン2） */
  kickDrawer(): this {
    return this.raw([0x1b, 0x70, 0x00, 0x32, 0xfa]);
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

/** 全角=2桁として文字幅を数える */
export function textWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    // ASCII と半角カナ以外は全角扱い
    w += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 1 : 2;
  }
  return w;
}

/** 左テキストと右テキストを1行に配置（80mm紙 = 48桁） */
export function padLine(left: string, right: string, cols = 48): string {
  const pad = cols - textWidth(left) - textWidth(right);
  if (pad < 1) return `${left}\n${" ".repeat(Math.max(0, cols - textWidth(right)))}${right}`;
  return left + " ".repeat(pad) + right;
}

export function hr(cols = 48): string {
  return "-".repeat(cols);
}

export function dashHr(cols = 48): string {
  return "- ".repeat(Math.ceil(cols / 2)).slice(0, cols);
}
