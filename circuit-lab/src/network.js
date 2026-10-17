// Deterministic virtual Wi-Fi association and UDP delivery. No RF, TCP, encryption,
// real socket access, 802.11 frames, ESP-IDF binary drivers or internet forwarding.
export class VirtualNetwork {
 constructor(){this.nodes=new Map();this.pending=[];this.events=[];this.time=0;this.enabled=()=>true;}
 node(id){if(!this.nodes.has(id))this.nodes.set(id,{id,mode:'off',status:6,queue:[],port:0,ip:'0.0.0.0'});return this.nodes.get(id);}
 log(type,id,message){this.events.push({time:this.time,type,board:id,message});if(this.events.length>150)this.events.shift();}
 reset(){this.nodes.clear();this.pending=[];this.events=[];this.time=0;}
 tick(time){this.time=time;for(const n of this.nodes.values())if(n.mode==='station'){
  const ap=[...this.nodes.values()].find(p=>p.mode==='ap'&&p.ssid===n.ssid&&p.password===n.password&&(!n.channel||p.channel===n.channel)&&this.enabled(p.id));
  if(ap&&time>=n.connectAt&&this.enabled(n.id)){if(n.status!==3){n.status=3;n.group=ap.id;n.ip='192.168.4.'+n.host;this.log('connected',n.id,`${n.ssid} · ${n.ip}`);}}
  else if(time>=n.connectAt+1000&&n.status===0){n.status=4;this.log('association failed',n.id,'SSID, password or channel did not match an active AP');}
  else if(n.status===3){n.status=6;n.group=null;n.ip='0.0.0.0';this.log('disconnected',n.id,'Access point unavailable');}
 }
 const due=this.pending.filter(p=>p.at<=time);this.pending=this.pending.filter(p=>p.at>time);
 for(const packet of due){const sender=this.nodes.get(packet.from),receivers=[...this.nodes.values()].filter(n=>n.id!==packet.from&&n.group===packet.group&&(n.ip===packet.ip||packet.ip==='192.168.4.255')&&n.port===packet.port&&(n.mode==='ap'||n.status===3)&&this.enabled(n.id));if(!sender||!this.enabled(sender.id)||sender.group!==packet.group)continue;let count=0;for(const n of receivers){if(n.queue.length<64){n.queue.push({text:packet.text,ip:sender.ip,port:sender.port});count++;}else this.log('dropped',n.id,'UDP receive queue full');}this.log(count?'delivered':'dropped',packet.from,`${packet.ip}:${packet.port} · ${packet.text.length} bytes · ${count} receiver${count===1?'':'s'}`);}
 }
 call(id,name,a){const n=this.node(id);switch(name){
 case'WiFi.softAP':if(typeof a[0]!=='string'||!a[0].length||a[0].length>32)throw Error('SSID must contain 1–32 characters.');if(a[1]&&String(a[1]).length<8)throw Error('Virtual WPA passphrase must have at least 8 characters.');Object.assign(n,{mode:'ap',ssid:a[0],password:String(a[1]??''),channel:a[2]??1,status:3,group:id,ip:'192.168.4.1'});this.log('access point',id,`${n.ssid} · channel ${n.channel}`);return 1;
 case'WiFi.begin':Object.assign(n,{mode:'station',ssid:String(a[0]),password:String(a[1]??''),channel:a[2]??0,status:0,group:null,ip:'0.0.0.0',connectAt:this.time+100,host:2+[...this.nodes.keys()].indexOf(id)});this.log('connecting',id,n.ssid);return 0;
 case'WiFi.status':return n.status;case'WiFi.localIP':case'WiFi.softAPIP':return n.ip;
 case'WiFi.disconnect':case'WiFi.softAPdisconnect':n.mode='off';n.status=6;n.group=null;n.ip='0.0.0.0';n.queue=[];this.log('disconnected',id,'Interface disabled');return 1;
 case'UDP.begin':if(!Number.isInteger(a[0])||a[0]<1||a[0]>65535)throw Error('UDP port must be 1–65535.');n.port=a[0];return 1;
 case'UDP.beginPacket':if(typeof a[0]!=='string'||!/^\d+\.\d+\.\d+\.\d+$/.test(a[0])||!Number.isInteger(a[1])||a[1]<1||a[1]>65535)throw Error('UDP.beginPacket requires an IPv4 string and port.');n.tx={ip:a[0],port:a[1],text:''};return 1;
 case'UDP.print':case'UDP.write':if(!n.tx)throw Error('Call UDP.beginPacket before writing.');const text=typeof a[0]==='number'&&name==='UDP.write'?String.fromCharCode(a[0]&255):String(a[0]);if(n.tx.text.length+text.length>256)throw Error('Virtual UDP payload limit is 256 characters.');n.tx.text+=text;return text.length;
 case'UDP.endPacket':if(!n.tx||n.status!==3||!n.group)return 0;if(this.pending.length>=256){this.log('dropped',id,'Network queue full');return 0;}this.pending.push({...n.tx,from:id,group:n.group,at:this.time+2});this.log('sent',id,`${n.tx.ip}:${n.tx.port} · ${n.tx.text}`);n.tx=null;return 1;
 case'UDP.parsePacket':return n.queue[0]?.text.length??0;case'UDP.readString':n.last=n.queue.shift();return n.last?.text??'';case'UDP.remoteIP':return (n.queue[0]??n.last)?.ip??'0.0.0.0';case'UDP.remotePort':return (n.queue[0]??n.last)?.port??0;case'UDP.stop':n.port=0;n.queue=[];return 0;
 default:throw Error(`Unsupported virtual network operation ${name}`);
 }}
 snapshot(){return {nodes:[...this.nodes.values()].map(({id,mode,status,ssid,channel,ip,port,queue})=>({id,mode,status,ssid,channel,ip,port,queued:queue.length})),events:this.events};}
}
