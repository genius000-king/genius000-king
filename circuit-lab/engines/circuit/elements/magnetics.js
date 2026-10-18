export function windings(k,list,ratedPrimary,report){const n=list.length,h=k.h,kc=.998,L=list.map(w=>w[2]),ip=k.s.i??list.map(()=>0);const Z=list.map((w,i)=>list.map((v,j)=>i===j?w[3]+L[i]/h:kc*Math.sqrt(L[i]*L[j])/h));const Y=invert(Z),Lm=list.map((w,i)=>list.map((v,j)=>(i===j?1:kc)*Math.sqrt(L[i]*L[j])/h));
 const E=Lm.map(row=>row.reduce((a,x,j)=>a+x*ip[j],0)),J=Y.map(row=>row.reduce((a,y,j)=>a+y*E[j],0)),nodes=list.map(([a,b])=>[k.n(a),k.n(b)]);
 k.nl((x,st)=>{for(let i=0;i<n;i++){const [ai,bi]=nodes[i];for(let j=0;j<n;j++){const [aj,bj]=nodes[j],y=Y[i][j];st.M(ai,aj,y);st.M(ai,bj,-y);st.M(bi,aj,-y);st.M(bi,bj,y);}st.rhs(ai,-J[i]);st.rhs(bi,J[i]);}return 'w';});
 const cur=()=>{const v=list.map(([a,b])=>k.v(a)-k.v(b));return {v,i:Y.map((row,i)=>row.reduce((s,y,j)=>s+y*v[j],0)+J[i])};};
 k.post(()=>{k.next.i=cur().i;});
 k.result(()=>{const {v,i}=cur();if(Math.abs(i[0])>2.5*ratedPrimary*Math.SQRT2)k.diag('error',`${k.c.name}: primary current ${(Math.abs(i[0])*1000).toFixed(0)} mA. The core is saturated or the winding is shorted; a transformer needs AC, not DC.`);return report(i,v);});}

export function invert(A){const n=A.length,M=A.map((r,i)=>[...r,...A.map((_,j)=>i===j?1:0)]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=0;j<2*n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];for(let j=0;j<2*n;j++)M[r][j]-=f*M[c][j];}}return M.map(r=>r.slice(n));}
