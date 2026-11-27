/** Minimal static server for the exported SPA: unknown paths fall back to index.html. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const path = normalize(new URL(req.url, 'http://localhost').pathname);
  let file = join(ROOT, path);
  let body = await readFile(file).catch(() => undefined);
  if (!body) {
    file = join(ROOT, 'index.html');
    body = await readFile(file);
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}).listen(Number(process.argv[2] ?? 8199));
