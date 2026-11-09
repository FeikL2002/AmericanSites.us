import {spawn} from 'node:child_process';
const children = [spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env:{...process.env,PORT:'4318',HOST:'127.0.0.1'}}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:(process.env.PORT||'5173')],{stdio:'inherit'})];
for(const child of children) child.on('exit',code=>{if(code){children.forEach(c=>c.kill());process.exitCode=code;}});
for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>{children.forEach(c=>c.kill(sig));process.exit(0);});
