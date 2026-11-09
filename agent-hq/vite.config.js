import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
const snapshot=new URL('../AmericanSites  "Live"/index.html',import.meta.url);
export default defineConfig({
 plugins:[{name:'safe-local-previews',configureServer(server){
 server.middlewares.use((req,res,next)=>{let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.statusCode=400;return res.end('Invalid path')}if(!path.startsWith('/prototypes/'))return next();if(!['/prototypes/practice-desk/index.html','/prototypes/practice-desk/'].includes(path)){res.statusCode=404;return res.end('Unknown prototype')} res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'");res.end(readFileSync(new URL('./public/prototypes/practice-desk/index.html',import.meta.url),'utf8'))});
 server.middlewares.use('/qa/website.html',(_req,res)=>{const html=readFileSync(snapshot,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'");res.end(html)})}}],
 server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{strict:true,deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/*.sqlite','**/*.sqlite-*','**/data/**']},allowedHosts:['localhost','127.0.0.1'],proxy:{'/api':{target:'http://127.0.0.1:4318',changeOrigin:true}}},build:{chunkSizeWarningLimit:1200}
});
