import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const api = createApi();
const root = fileURLToPath(new URL('../dist/',import.meta.url));
if (!existsSync(resolve(root,'index.html'))) {
  console.error('Gere os arquivos de publicação com npm run build.');
  process.exit(1);
}
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.glb':'model/gltf-binary','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png' };
const server = createServer(async (req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname.startsWith('/api/')) return api.handle(req,res);
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const page = pathname==='/'?'/index.html':
      ['/admin/r/valdoria','/admin/r/valdoria/'].includes(pathname)?'/admin/r/valdoria/index.html':pathname;
    const path=resolve(root,'.'+page);
    if (!path.startsWith(root.endsWith(sep)?root:root+sep)) { res.writeHead(404).end(); return; }
    const info = await stat(path).catch(()=>null);
    if (!info?.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':info.size,
      'Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'});
    if (req.method==='HEAD') res.end();
    else createReadStream(path).pipe(res);
  } catch { res.writeHead(400).end(); }
});
const port = Number(process.env.PORT || 4189);
server.listen(port,process.env.HOST || '0.0.0.0',()=>console.log(`Reino de Valdória em http://localhost:${port}`));
function shutdown() { server.close(async()=>{await api.close();}); }
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

