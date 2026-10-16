import { promises as fs } from "fs";
import path from "path";
import { INITIAL_PIECES, parsePieceList } from "@/components/furniture";

function configPath() {
  return path.join(process.cwd(), "src", "config", "furniture.json");
}

async function storedPieces() {
  const raw = await fs.readFile(configPath(), "utf8");
  const data = JSON.parse(raw);
  const pieces = parsePieceList((data as { pieces?: unknown }).pieces);
  for (const initial of INITIAL_PIECES) {
    if (!pieces.some((piece) => piece.id === initial.id)) {
      pieces.push({ ...initial });
    }
  }
  return pieces;
}

function sanitizePieces(input: unknown) {
  if (!Array.isArray(input)) return null;
  const pieces = parsePieceList(input);
  if (pieces.length === 0) return null;
  for (const initial of INITIAL_PIECES) {
    if (!pieces.some((piece) => piece.id === initial.id)) {
      pieces.push({ ...initial });
    }
  }
  return pieces;
}

export async function GET() {
  try {
    return Response.json({ pieces: await storedPieces() });
  } catch {
    return Response.json({ pieces: INITIAL_PIECES });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const pieces = sanitizePieces((body as { pieces?: unknown }).pieces);
  if (!pieces) {
    return Response.json({ ok: false, error: "invalid pieces" }, { status: 400 });
  }
  await fs.writeFile(
    configPath(),
    `${JSON.stringify({ pieces }, null, 2)}\n`,
    "utf8"
  );
  return Response.json({ ok: true, pieces });
}
