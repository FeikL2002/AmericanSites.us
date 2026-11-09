import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
const snapshot=new URL('../AmericanSites  "Live"/index.html',import.meta.url);
export default defineConfig({
 plugins:[{name:'safe-keyboard-review',configureServer(server){server.middlewares.use('/qa/website.html',(_req,res)=>{const html=readFileSync(snapshot,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'");res.end(html)})}}],
 server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{strict:true,deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/*.sqlite','**/*.sqlite-*','**/data/**']},allowedHosts:['localhost','127.0.0.1'],proxy:{'/api':{target:'http://127.0.0.1:4318',changeOrigin:true}}},build:{chunkSizeWarningLimit:1200}
});
