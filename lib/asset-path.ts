declare const __FLY_ASSET_BASE__: string | undefined;
export function assetPath(path: string): string {
 const base=typeof __FLY_ASSET_BASE__==='string'?__FLY_ASSET_BASE__:'/';
 return base+path.replace(/^\/+/, '');
}
