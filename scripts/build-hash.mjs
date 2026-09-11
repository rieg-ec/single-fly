import {build} from 'vite';
await build({configFile:false,publicDir:false,logLevel:'warn',build:{lib:{entry:'node_modules/@noble/hashes/esm/sha256.js',formats:['es'],fileName:()=> 'sha256.mjs'},outDir:'public/brain/hash',emptyOutDir:true,minify:true}});
