import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>{
 const base=process.env.FLY_BASE_PATH||(mode==='pages'?'/single-fly/':'/');
 if(!base.startsWith('/')||!base.endsWith('/'))throw Error('FLY_BASE_PATH must start and end with /');
 return {
  root:fileURLToPath(new URL('./cloudflare',import.meta.url)),
  publicDir:fileURLToPath(new URL('./public',import.meta.url)),
  base,
  define:{__FLY_ASSET_BASE__:JSON.stringify(base)},
  plugins:[react()],
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
  build:{outDir:mode==='pages'?'../dist-pages':'../dist-cloudflare',emptyOutDir:true},
 };
});
