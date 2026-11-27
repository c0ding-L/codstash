/** Plain ANSI colours, off when `NO_COLOR` is set or the stream is not a terminal. */
export interface Paint {
  red: (text: string) => string;
  yellow: (text: string) => string;
  dim: (text: string) => string;
  bold: (text: string) => string;
}

export function paint(stream: { isTTY?: boolean }, env: NodeJS.ProcessEnv = process.env): Paint {
  const on = Boolean(stream.isTTY) && !env.NO_COLOR;
  const wrap = (open: number, close: number) => (text: string) => (on ? `\x1b[${open}m${text}\x1b[${close}m` : text);
  return { red: wrap(31, 39), yellow: wrap(33, 39), dim: wrap(2, 22), bold: wrap(1, 22) };
}
