import {ROOM_CAP,roomPlan,roomTopic,wireMessage,normalPosition,activeVisitors,
  presenceSnapshot,applyPresenceDiff,safeVisitor,MOVE_INTERVAL_MS} from './memorial-walk-core.mjs';

// Minimal Phoenix WebSocket protocol 1.0 client. The protocol is documented at
// https://supabase.com/docs/guides/realtime/protocol (2026-11-05).
// Intentionally avoids database subscriptions and persistent visitor data.
export class MemorialWalkRelay {
  constructor(options) {
    this.api=options.api||'';this.key=options.key||'';
    this.id=options.id;this.tone=options.tone;
    this.WebSocketImpl=options.WebSocketImpl||globalThis.WebSocket;
    this.onStatus=options.onStatus||(()=>{});
    this.onPeers=options.onPeers||(()=>{});
    this.onMove=options.onMove||(()=>{});
    this.position=normalPosition(options.x,options.y)||{x:.5,y:.78};
    this.plan=roomPlan(options.seed||0);
    this.ws=null;this.joined=false;this.joinRef=null;this.seq=0;
    this.attempt=0;this.presence=Object.create(null);this.remoteMoves=new Map();
    this.lastSent=0;this.pending=null;this.moveTimer=null;
    this.heartbeat=null;this.joinTimer=null;this.active=false;
  }
  get configured() {
    return /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(this.api) &&
      /^sb_publishable_[\w-]+$/.test(this.key) && typeof this.WebSocketImpl==='function';
  }
  _status(status,details='') {this.onStatus(status,details,this.plan[this.attempt]??-1);}
  start() {
    this.stop();this.active=true;this.attempt=0;
    if (!this.configured) {this.active=false;this._status('unavailable');return;}
    this._open();
  }
  _open() {
    if(!this.active || this.attempt>=this.plan.length) {this.active=false;this._status('full');return;}
    this.joined=false;this.joinRef=null;this.presence=Object.create(null);this.remoteMoves.clear();
    this.onPeers([]);
    const index=this.plan[this.attempt];this.topic=roomTopic(index);
    this._status('connecting');
    const url=this.api.replace(/^https:/,'wss:')+'/realtime/v1/websocket?vsn=1.0.0&apikey='+encodeURIComponent(this.key);
    let socket;
    try {socket=new this.WebSocketImpl(url);}catch(_){this.active=false;this._status('unavailable');return;}
    this.ws=socket;
    socket.onopen=()=>{
      if(socket!==this.ws)return;
      this.joinRef=String(++this.seq);
      const payload={
        config:{broadcast:{ack:false,self:false},presence:{enabled:true,key:this.id},
          postgres_changes:[],private:false}};
      // A join acknowledgement uses the join push's ref, not the next message ref.
      socket.send(wireMessage(this.topic,'phx_join',payload,this.joinRef,this.joinRef));
    };
    socket.onmessage=event=>{
      if(socket!==this.ws || typeof event.data!=='string'||event.data.length>16384)return;
      let message;try{message=JSON.parse(event.data);}catch(_){return;}
      this._receive(message);
    };
    socket.onerror=()=>{};
    socket.onclose=()=>{
      if(socket!==this.ws)return;
      this._clearTimers();this.ws=null;this.joined=false;this.presence=Object.create(null);
      this.onPeers([]);if(this.active){this.active=false;this._status('unavailable');}
    };
    this.joinTimer=setTimeout(()=>{if(socket===this.ws&&!this.joined){this.active=false;this._disconnect();this._status('unavailable');}},10000);
  }
  _send(topic,event,payload,joinRef=this.joinRef) {
    if(!this.ws || this.ws.readyState!==1)return false;
    this.ws.send(wireMessage(topic,event,payload,++this.seq,joinRef));return true;
  }
  _receive(msg) {
    if(!msg || typeof msg!=='object')return;
    if(msg.event==='phx_reply'&&msg.ref===this.joinRef && msg.topic===this.topic){
      if(msg.payload?.status!=='ok'){this.active=false;this._disconnect();this._status('unavailable');return;}
      this.joined=true;clearTimeout(this.joinTimer);this.joinTimer=null;
      this._send(this.topic,'presence',{type:'presence',event:'track',payload:{
        x:this.position.x,y:this.position.y,tone:this.tone}});
      this.heartbeat=setInterval(()=>this._send('phoenix','heartbeat',{},null),20000);
      this._status('online');return;
    }
    if(msg.topic!==this.topic||!this.joined)return;
    if(msg.event==='presence_state'){
      this.presence=presenceSnapshot(msg.payload);this._refresh();return;
    }
    if(msg.event==='presence_diff'){
      this.presence=applyPresenceDiff(this.presence,msg.payload);this._refresh();return;
    }
    if(msg.event==='broadcast'&&msg.payload?.event==='move'){
      const peer=msg.payload.payload;
      if(!peer || !this.presence[peer.id]||peer.id===this.id)return;
      const safe=safeVisitor(peer.id,{x:peer.x,y:peer.y,tone:peer.tone});
      if(!safe)return;
      const previous=this.remoteMoves.get(peer.id);
      const now=Date.now();
      if(previous && now-previous.received<800)return;
      this.remoteMoves.set(peer.id,{...safe,received:now});
      this._publish();
    }
    if(msg.event==='phx_error'||msg.event==='phx_close'){
      this.active=false;this._disconnect();this._status('unavailable');
    }
  }
  _refresh() {
    const ids=Object.keys(this.presence);
    if(ids.filter(id=>id!==this.id).length>=ROOM_CAP || ids.length>ROOM_CAP){
      this._disconnect();this.attempt++;this._open();return;
    }
    for(const id of this.remoteMoves.keys())if(!this.presence[id])this.remoteMoves.delete(id);
    this._publish();
  }
  _publish() {
    const visitors=activeVisitors(this.presence,this.id,this.position).map(peer=>{
      const recent=this.remoteMoves.get(peer.id);
      return recent?{...peer,x:recent.x,y:recent.y}:peer;
    });
    this.onPeers(visitors);
  }
  move(x,y) {
    const pos=normalPosition(x,y);if(!pos)return;
    this.position=pos;this._publish();
    if(!this.joined)return;
    this.pending={id:this.id,tone:this.tone,x:pos.x,y:pos.y};
    const elapsed=Date.now()-this.lastSent;
    if(elapsed>=MOVE_INTERVAL_MS){this._flushMove();return;}
    if(!this.moveTimer)this.moveTimer=setTimeout(()=>{this.moveTimer=null;this._flushMove();},MOVE_INTERVAL_MS-elapsed);
  }
  _flushMove() {
    if(!this.pending || !this.joined)return;
    if(this._send(this.topic,'broadcast',{type:'broadcast',event:'move',payload:this.pending})){
      this.lastSent=Date.now();this.pending=null;
    }
  }
  _clearTimers() {
    clearTimeout(this.joinTimer);clearInterval(this.heartbeat);clearTimeout(this.moveTimer);
    this.joinTimer=null;this.heartbeat=null;this.moveTimer=null;this.pending=null;
  }
  _disconnect() {
    this._clearTimers();const socket=this.ws;this.ws=null;this.joined=false;
    if(socket){
      if(socket.readyState===1){try{socket.send(wireMessage(this.topic,'phx_leave',{},++this.seq,this.joinRef));}catch(_){}}
      try{socket.close();}catch(_){}
    }
    this.presence=Object.create(null);this.remoteMoves.clear();this.onPeers([]);
  }
  stop() {this.active=false;this._disconnect();this._status('solo');}
}
