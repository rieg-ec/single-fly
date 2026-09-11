import {execFileSync} from 'node:child_process';
execFileSync('node_modules/.bin/esbuild',['public/brain/worker-source.mjs','--bundle','--format=iife','--platform=browser','--outfile=public/brain/worker.mjs'],{stdio:'inherit'});
