export function typeInfo(t,intBits=32,doubleBits=64){switch(t){case'int':return{k:'i',bits:intBits,s:true};case'uint':return{k:'i',bits:intBits,s:false};case'long':case's32':return{k:'i',bits:32,s:true};case'ulong':case'u32':return{k:'i',bits:32,s:false};case'short':case's16':return{k:'i',bits:16,s:true};case'u16':return{k:'i',bits:16,s:false};case'byte':case'u8':return{k:'i',bits:8,s:false};case'char':case's8':return{k:'i',bits:8,s:true};case'bool':return{k:'b'};case'float':return{k:'f32'};case'double':return doubleBits===32?{k:'f32'}:{k:'f64'};case'String':return{k:'s'};default:return{k:'any'};}}

export function castValue(v,t){switch(t.k){case'i':{if(typeof v==='string')v=parseInt(v)||0;if(!Number.isFinite(v))return 0;v=Math.trunc(v);if(t.bits===32)return t.s?v|0:v>>>0;const m=2**t.bits;v=((v%m)+m)%m;return t.s&&v>=m/2?v-m:v;}case'f32':return Math.fround(Number(v));case'f64':return Number(v);case'b':return v?1:0;case's':return String(v);default:return v;}}

export function normalizeType(words,line){const w=words.filter(x=>!['const','volatile','static','constexpr','inline','signed'].includes(x));const has=x=>w.includes(x);if(has('auto'))return 'double';if(has('void'))return 'void';if(has('String'))return 'String';if(has('bool')||has('boolean'))return 'bool';if(has('float'))return 'float';if(has('double'))return 'double';
 if(has('uint8_t')||has('byte'))return 'byte';if(has('int8_t'))return 's8';if(has('uint16_t')||has('word'))return 'u16';if(has('int16_t'))return 's16';if(has('uint32_t'))return 'u32';if(has('int32_t'))return 's32';if(has('uint64_t')||has('int64_t'))return 'double';if(has('size_t'))return 'uint';
 const u=words.includes('unsigned');if(has('char'))return u?'byte':'char';if(has('short'))return u?'u16':'short';if(has('long'))return u?'ulong':'long';return u?'uint':'int';}

export const isFloatT=t=>t==='float'||t==='double';

export const isIntT=t=>!isFloatT(t)&&t!=='String'&&t!=='void'&&!t?.startsWith?.('obj:');

export const RANK={bool:1,char:1,s8:1,byte:1,short:1,s16:1,u16:1,int:2,uint:2,long:3,s32:3,ulong:3,u32:3};

export function arith(a,b,intBits){if(a==='String'||b==='String')return 'String';if(isFloatT(a)||isFloatT(b))return a==='double'||b==='double'?'double':'float';const pa=(RANK[a]??2)<2||(intBits===32&&['u16'].includes(a))?'int':a,pb=(RANK[b]??2)<2||(intBits===32&&['u16'].includes(b))?'int':b;const ra=RANK[pa]??2,rb=RANK[pb]??2;const pick=ra>rb?pa:rb>ra?pb:(['uint','ulong','u32'].includes(pa)?pa:pb);return pick==='s32'?'long':pick==='u32'?'ulong':pick;}
