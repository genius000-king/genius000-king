export const BREADBOARD_TOP={mini:4.3,half:8.6,full:8.6};

export function breadboardTerminals(kind){const a=[];
 if(kind==='mini'){for(let col=0;col<17;col++)for(let r=0;r<10;r++)a.push({id:`${String.fromCharCode(65+r)}${col+1}`,p:[(col-8)*2.54,4.3,(r<5?r-5.5:r-3.5)*2.54],label:`${String.fromCharCode(65+r)}${col+1}`,strip:`${col}-${r<5?'top':'bottom'}`});return a;}
 const cols=kind==='half'?30:63,groups=kind==='half'?5:10,y=8.6,c0=(cols-1)/2,g0=(groups*6-2)/2;
 for(let col=0;col<cols;col++)for(let r=0;r<10;r++)a.push({id:`${String.fromCharCode(65+r)}${col+1}`,p:[(col-c0)*2.54,y,(r<5?r-5.5:r-3.5)*2.54],label:`${String.fromCharCode(65+r)}${col+1}`,strip:`${col}-${r<5?'top':'bottom'}`});
 for(const [rail,z,label]of [['TP',-21.59,'+'],['TN',-19.05,'−'],['BN',19.05,'−'],['BP',21.59,'+']])for(let k=0;k<groups*5;k++){const g=Math.floor(k/5),i=k%5;a.push({id:`${rail}${k+1}`,p:[(g*6+i-g0)*2.54,y,z],label:`${label} rail ${k+1}`,strip:rail,rail:label});}
 return a;}
