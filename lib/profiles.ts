import evaluationProfiles from './evaluation-profiles.json';
export type Profile={id:number|string;name:string;age?:number;city?:string;bio?:string;tags?:string[];image:string};
// Only withheld evaluation portraits. Ratings are deliberately absent from runtime inputs.
export const profiles:Profile[]=evaluationProfiles.map(p=>({...p,name:`Portrait ${p.id}`}));
export const profileAt=(index:number)=>profiles[index%profiles.length];
