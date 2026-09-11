/** Learned readout of actual spike counts. No image labels or IDs enter this function. */
export function predict(counts,model){
 let logit=model.bias;
 for(const feature of model.features){let sum=0;for(const i of feature.indices)sum+=counts[i];logit+=feature.weight*sum/feature.indices.length;}
 const score=1/(1+Math.exp(-Math.max(-40,Math.min(40,logit))));
 return {score,decision:score>=.5?'like':'pass',modelVersion:model.version};
}
