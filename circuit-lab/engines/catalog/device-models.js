export const BJT_MODELS={'2N2222A':{order:['E','B','C'],is:14.34e-15,bf:255.9,br:6.092,vceo:40,icmax:.8,npn:true},'BC547':{order:['C','B','E'],is:7.049e-15,bf:374,br:1,vceo:45,icmax:.1,npn:true},'2N3904':{order:['E','B','C'],is:6.734e-15,bf:416.4,br:.7371,vceo:40,icmax:.2,npn:true},'TIP120':{order:['B','C','E'],is:5e-12,bf:1000,br:1,vceo:60,icmax:5,npn:true,darlington:true},'2N2907A':{order:['E','B','C'],is:650.6e-18,bf:231.7,br:3.563,vceo:60,icmax:.6,npn:false},'BC557':{order:['C','B','E'],is:9e-15,bf:300,br:1,vceo:45,icmax:.1,npn:false}};

export const MOS_MODELS={'IRLZ44N':{order:['G','D','S'],vth:1.7,k:20,lambda:.01,vdsmax:55,idmax:47,pkg:'TO-220',logic:true},'IRF520':{order:['G','D','S'],vth:3,k:1.2,lambda:.01,vdsmax:100,idmax:9,pkg:'TO-220'},'2N7000':{order:['S','G','D'],vth:2.1,k:.12,lambda:.02,vdsmax:60,idmax:.2,pkg:'TO-92',logic:true},'IRF9540 (P)':{order:['G','D','S'],vth:-3.5,k:3,lambda:.01,vdsmax:100,idmax:19,pkg:'TO-220',p:true}};

export const DIODE_MODELS={'1N4007':{is:7.03e-9,n:1.81,rs:.034,vrrm:1000,imax:1},'1N4148':{is:2.52e-9,n:1.752,rs:.568,vrrm:100,imax:.3},'1N5819':{is:31.7e-6,n:1.373,rs:.051,vrrm:40,imax:1},'1N4733A (5.1 V Zener)':{is:1e-12,n:1.1,rs:.5,bv:5.1,izt:.049,rz:7,zener:true,imax:.178},'1N4742A (12 V Zener)':{is:1e-12,n:1.1,rs:.5,bv:12,izt:.021,rz:9,zener:true,imax:.076},'1N5408':{is:1e-8,n:1.75,rs:.012,vrrm:1000,imax:3}};

export const REG_MODELS={'LM7805':{order:['IN','GND','OUT'],vout:5,dropout:2,iq:.005,imax:1.5,vinmax:35},'LD1117V33':{order:['GND','OUT','IN'],vout:3.3,dropout:1.1,iq:.005,imax:.8,vinmax:15},'LM7812':{order:['IN','GND','OUT'],vout:12,dropout:2,iq:.005,imax:1.5,vinmax:35}};

export const TRANSFORMER_MODELS={'230 V → 12 V · 12 VA (EI-48)':{vp:230,vs:12,lp:20,rp:95,rs:.85,va:12},'230 V → 6 V · 6 VA (EI-42)':{vp:230,vs:6,lp:16,rp:210,rs:.6,va:6},'12 V → 12 V · isolation 1:1':{vp:12,vs:12,lp:.8,rp:1.2,rs:1.2,va:10},'Audio · 1 kΩ : 8 Ω output':{vp:11.2,vs:1,lp:2,rp:40,rs:.4,va:.5}};

export const CT_TRANSFORMER_MODELS={'230 V → 9-0-9 V · 6 VA':{vp:230,vs:9,lp:16,rp:210,rs:.9,va:6},'230 V → 12-0-12 V · 12 VA':{vp:230,vs:12,lp:20,rp:95,rs:1,va:12}};

export const FUSE_MODELS={'F500mA · fast glass 5×20':{rating:.5,tau:.05,blow:2.2},'T1A · slow glass 5×20':{rating:1,tau:1.5,blow:2.2},'F2A · fast glass 5×20':{rating:2,tau:.05,blow:2.2},'PTC 500 mA · resettable (MF-R050)':{rating:.5,tau:.8,blow:1.7,ptc:true}};

export const BRIDGE_MODELS={'DB107 · 1 A 1000 V':{diode:'1N4007',imax:1},'KBP307 · 3 A 700 V':{diode:'1N5408',imax:3}};

export const bjtPins=c=>{const m=BJT_MODELS[c.params?.model]??BJT_MODELS['2N2222A'];return m.order.map((id,i)=>[id,(i-1)*2.54,1,0]);};

export const mosPins=c=>{const m=MOS_MODELS[c.params?.model]??MOS_MODELS.IRLZ44N;return m.order.map((id,i)=>[id,(i-1)*2.54,1,0]);};

export const regPins=c=>{const m=REG_MODELS[c.params?.model]??REG_MODELS.LM7805;return m.order.map((id,i)=>[id,(i-1)*2.54,1,0]);};
