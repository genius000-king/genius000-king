export const row=(ids,x0,z,y=1,step=2.54)=>ids.map((id,i)=>[id,x0+i*step,y,z]);

export const dip=(names,z=3.81)=>{const n=names.length/2;return names.map((id,i)=>i<n?[id,(-(n-1)/2+i)*2.54,1,z]:[id,((n-1)/2-(i-n))*2.54,1,-z]);};

export const num=(key,label,min,max,step,unit,extra={})=>({key,label,type:'number',min,max,step,unit,...extra});

export const range=(key,label,min,max,step,unit,extra={})=>({key,label,type:'range',min,max,step,unit,live:true,...extra});

export const select=(key,label,options,extra={})=>({key,label,type:'select',options,...extra});

export const ro=(key,label,unit,scale=1,digits=2)=>({key,label,unit,scale,digits});

export const V=ro('voltage','Voltage','V',1,3);

export const I=ro('current','Current','mA',1000,2);

export const P=ro('power','Power','mW',1000,1);
