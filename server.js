const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('*', (_req, res) => res.sendFile(process.cwd() + '/public/index.html'));

const makeCode = () => { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s; };
const cleanName = s => String(s||'').trim().replace(/\s+/g,' ').slice(0,24);
const sortedPlayers = room => [...room.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,connected:p.connected})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'vi'));
function publicRoom(room) {
  const players=sortedPlayers(room);
  const fullBoard=room.phase==='finished' && room.leaderboardPublished;
  const displayPlayers=fullBoard||players.length<=6?players:players.slice(0,4);
  return { code:room.code, phase:room.phase, questionsCount:room.questions.length, questionIndex:room.questionIndex,
    question:room.questionVisible?room.questions[room.questionIndex]?.question||'':'', answer:room.answerShown?room.questions[room.questionIndex]?.answer||'':null,
    answerShown:room.answerShown, buzzerDeadline:room.buzzerDeadline, answerDeadline:room.answerDeadline,
    buzzerDuration:room.buzzerDuration, answerDuration:room.answerDuration, buzzerOpenedAt:room.buzzerOpenedAt,
    buzzers:room.buzzers.map(b=>({...b})), buzzedPlayerId:room.buzzers[0]?.playerId||null,
    buzzedPlayerName:room.buzzers[0]?.name||null, lastResult:room.lastResult, players, displayPlayers,
    hostConnected:room.hostConnected, leaderboardPublished:room.leaderboardPublished };
}
function emitRoom(room){
  const state=publicRoom(room); io.to(room.code).emit('room:update',state);
  const privateState={...state,answer:room.questions[room.questionIndex]?.answer||''};
  if(room.hostSocketId)io.to(room.hostSocketId).emit('host:private-update',privateState);
  io.to('mc:'+room.code).emit('mc:private-update',privateState);
}
function clearTimers(room){for(const key of ['buzzerTimer','collectionTimer','answerTimer']){if(room[key])clearTimeout(room[key]);room[key]=null;}}
function hostCheck(socket,room,token){if(!room||!token||token!==room.hostToken||room.hostSocketId!==socket.id){socket.emit('app:error','Bạn không có quyền điều khiển phòng này.');return false;}return true;}
function hostAction(socket,data,fn){const room=rooms.get(String(data?.code||'').toUpperCase());if(!hostCheck(socket,room,data?.token))return;fn(room);}
function startAnswerTimer(room){room.answerDeadline=null;if(room.answerDuration===0)return;room.answerDeadline=Date.now()+room.answerDuration*1000;room.answerTimer=setTimeout(()=>{room.answerTimer=null;if(room.phase==='answering'){room.phase='timeout_pending';room.answerDeadline=null;emitRoom(room);}},room.answerDuration*1000);}
function closeBuzzer(room){if(!['buzzer_open','collecting'].includes(room.phase))return;clearTimeout(room.collectionTimer);room.collectionTimer=null;clearTimeout(room.buzzerTimer);room.buzzerTimer=null;room.buzzerDeadline=null;room.phase=room.buzzers.length?'answering':'no_buzz';if(room.buzzers.length)startAnswerTimer(room);emitRoom(room);}
function resetAttempt(room){clearTimers(room);room.phase='reading';room.questionVisible=true;room.answerShown=false;room.buzzerDeadline=null;room.answerDeadline=null;room.buzzerOpenedAt=null;room.buzzers=[];room.lastResult=null;}

io.on('connection',socket=>{
 socket.on('room:create',({questions,buzzerDuration=15,answerDuration=5}={})=>{
  if(!Array.isArray(questions)||!questions.length||questions.length>500)return socket.emit('app:error','Hãy nhập ít nhất 1 câu hỏi (tối đa 500 câu).');
  const valid=questions.map(q=>({question:String(q.question||'').trim().slice(0,1000),answer:String(q.answer||'').trim().slice(0,500)})).filter(q=>q.question&&q.answer);
  if(!valid.length)return socket.emit('app:error','Không tìm thấy cặp câu hỏi và câu trả lời hợp lệ.');
  let code;do{code=makeCode();}while(rooms.has(code));
  const bd=Number(buzzerDuration),ad=Number(answerDuration);
  const room={code,hostToken:crypto.randomBytes(24).toString('hex'),hostSocketId:socket.id,hostConnected:true,players:new Map(),questions:valid,questionIndex:0,phase:'lobby',questionVisible:false,answerShown:false,buzzerDuration:Number.isFinite(bd)&&bd>=0?bd:15,answerDuration:Number.isFinite(ad)&&ad>=0?ad:5,buzzerDeadline:null,answerDeadline:null,buzzerOpenedAt:null,buzzers:[],lastResult:null,leaderboardPublished:false,buzzerTimer:null,collectionTimer:null,answerTimer:null};
  rooms.set(code,room);socket.join(code);socket.emit('room:created',{code,hostToken:room.hostToken,state:publicRoom(room)});emitRoom(room);
 });
 socket.on('host:reconnect',({code,token}={})=>{const room=rooms.get(String(code||'').toUpperCase());if(!room||token!==room.hostToken)return socket.emit('app:error','Không tìm thấy phòng hoặc mã quản trị không hợp lệ.');if(room.hostSocketId&&room.hostSocketId!==socket.id){const old=io.sockets.sockets.get(room.hostSocketId);if(old)old.leave(room.code);}room.hostSocketId=socket.id;room.hostConnected=true;socket.join(room.code);socket.emit('room:update',publicRoom(room));socket.emit('host:private-update',{...publicRoom(room),answer:room.questions[room.questionIndex]?.answer||''});emitRoom(room);});
 socket.on('screen:join',({code}={})=>{const room=rooms.get(String(code||'').toUpperCase());if(!room)return socket.emit('app:error','Không tìm thấy phòng trình chiếu.');socket.join(room.code);socket.emit('room:update',publicRoom(room));});
 socket.on('mc:join',({code}={})=>{const room=rooms.get(String(code||'').toUpperCase());if(!room)return socket.emit('app:error','Không tìm thấy phòng MC quan sát.');socket.join('mc:'+room.code);socket.emit('mc:private-update',{...publicRoom(room),answer:room.questions[room.questionIndex]?.answer||''});});
 socket.on('player:join',({code,name,playerId}={})=>{
  const room=rooms.get(String(code||'').toUpperCase());if(!room)return socket.emit('app:error','Mã phòng không tồn tại. Hãy kiểm tra lại mã hoặc QR.');
  if(room.phase==='finished')return socket.emit('app:error','Cuộc thi đã kết thúc, không thể tham gia thêm.');
  const playerName=cleanName(name);if(!playerName)return socket.emit('app:error','Bạn hãy nhập tên trước khi tham gia.');
  let id=String(playerId||'');let player=id?room.players.get(id):null;
  if(!player){if(room.players.size>=12)return socket.emit('app:error','Phòng đã đủ 12 thí sinh.');if([...room.players.values()].some(p=>p.name.toLocaleLowerCase()===playerName.toLocaleLowerCase()))return socket.emit('app:error','Tên này đã có người sử dụng trong phòng. Hãy chọn tên khác.');id=crypto.randomUUID();player={id,name:playerName,score:0,connected:true,socketId:socket.id};room.players.set(id,player);}else{player.name=playerName;player.connected=true;player.socketId=socket.id;}
  socket.data.roomCode=room.code;socket.data.playerId=id;socket.join(room.code);socket.emit('player:joined',{playerId:id,code:room.code,state:publicRoom(room)});emitRoom(room);
 });
 socket.on('host:start-question',data=>hostAction(socket,data,room=>{if(!['lobby','ready'].includes(room.phase))return socket.emit('app:error','Chưa thể bắt đầu câu hỏi lúc này.');if(!room.players.size)return socket.emit('app:error','Chưa có thí sinh nào tham gia.');if(room.questionIndex>=room.questions.length)return socket.emit('app:error','Đã hết câu hỏi.');resetAttempt(room);emitRoom(room);}));
 socket.on('host:open-buzzer',data=>hostAction(socket,data,room=>{if(room.phase!=='reading')return socket.emit('app:error','Hãy hiển thị câu hỏi trước khi mở chuông.');room.phase='buzzer_open';room.buzzerOpenedAt=Date.now();room.buzzerDeadline=room.buzzerDuration?Date.now()+room.buzzerDuration*1000:null;if(room.buzzerDuration)room.buzzerTimer=setTimeout(()=>{room.buzzerTimer=null;if(room.phase==='buzzer_open')closeBuzzer(room);},room.buzzerDuration*1000);emitRoom(room);}));
 socket.on('player:buzz',({code,playerId}={})=>{
  const room=rooms.get(String(code||'').toUpperCase());const player=room?.players.get(String(playerId||''));if(!room||!player||player.socketId!==socket.id)return;
  const now=Date.now();if(room.phase!=='buzzer_open'&&room.phase!=='collecting')return socket.emit('buzz:rejected','Chuông hiện không mở hoặc đã khóa.');
  if(room.buzzerDeadline&&now>room.buzzerDeadline)return socket.emit('buzz:rejected','Đã hết thời gian bấm chuông.');
  if(room.buzzers.length>=3||room.buzzers.some(b=>b.playerId===player.id))return;
  const elapsed=Math.max(0,now-room.buzzerOpenedAt)/1000;room.buzzers.push({playerId:player.id,name:player.name,elapsed:Number(elapsed.toFixed(3))});
  if(room.buzzers.length===1){room.phase='collecting';if(room.buzzerTimer){clearTimeout(room.buzzerTimer);room.buzzerTimer=null;}room.buzzerDeadline=null;room.collectionTimer=setTimeout(()=>closeBuzzer(room),1500);}
  emitRoom(room);socket.emit('buzz:accepted');
 });
 socket.on('host:mark',data=>hostAction(socket,data,room=>{if(!['answering','timeout_pending'].includes(room.phase)||!room.buzzers.length)return socket.emit('app:error','Hiện không có lượt trả lời cần xác nhận.');const p=room.players.get(room.buzzers[0].playerId);if(!p)return socket.emit('app:error','Không tìm thấy thí sinh.');clearTimers(room);if(data.correct){p.score+=10;room.lastResult={playerId:p.id,playerName:p.name,correct:true,delta:10};}else{p.score=Math.max(0,p.score-5);room.lastResult={playerId:p.id,playerName:p.name,correct:false,delta:-5};}room.phase='resolved';room.answerDeadline=null;emitRoom(room);}));
 socket.on('host:show-answer',data=>hostAction(socket,data,room=>{if(!['no_buzz','resolved'].includes(room.phase))return socket.emit('app:error','Hãy xác nhận kết quả lượt trả lời trước khi công bố đáp án.');room.answerShown=true;emitRoom(room);}));
 socket.on('host:next',data=>hostAction(socket,data,room=>{if(!['no_buzz','resolved'].includes(room.phase))return socket.emit('app:error','Hãy xác nhận kết quả lượt trả lời trước khi chuyển câu.');if(room.questionIndex+1>=room.questions.length)return socket.emit('app:error','Đã hết câu hỏi. Hãy kết thúc trò chơi khi sẵn sàng.');room.questionIndex++;resetAttempt(room);emitRoom(room);}));
 socket.on('host:set-score',data=>hostAction(socket,data,room=>{const player=room.players.get(String(data?.playerId||''));const score=Number(data?.score);if(!player)return socket.emit('app:error','Không tìm thấy thí sinh cần chỉnh điểm.');if(!Number.isSafeInteger(score)||score<0)return socket.emit('app:error','Tổng điểm phải là số nguyên không âm.');player.score=score;emitRoom(room);}));
 socket.on('host:restart-question',data=>hostAction(socket,data,room=>{if(!['no_buzz','resolved'].includes(room.phase))return socket.emit('app:error','Chỉ có thể mở lại sau khi lượt hiện tại kết thúc.');resetAttempt(room);emitRoom(room);}));
 socket.on('host:end-game',data=>hostAction(socket,data,room=>{if(room.phase==='finished')return;clearTimers(room);room.phase='finished';room.answerShown=true;room.leaderboardPublished=false;room.buzzerDeadline=room.answerDeadline=null;emitRoom(room);}));
 socket.on('host:publish-leaderboard',data=>hostAction(socket,data,room=>{if(room.phase!=='finished')return socket.emit('app:error','Hãy kết thúc trò chơi trước khi công bố bảng xếp hạng.');room.leaderboardPublished=true;emitRoom(room);}));
 socket.on('host:reset-scores',data=>hostAction(socket,data,room=>{if(room.phase==='finished')return socket.emit('app:error','Trò chơi đã kết thúc.');for(const p of room.players.values())p.score=0;emitRoom(room);}));
 socket.on('host:remove-player',data=>hostAction(socket,data,room=>{if(room.buzzers.some(b=>b.playerId===data.playerId)&&['collecting','answering','timeout_pending'].includes(room.phase))return socket.emit('app:error','Không thể xóa thí sinh đang có lượt bấm chuông.');room.players.delete(data.playerId);emitRoom(room);}));
 socket.on('disconnect',()=>{for(const room of rooms.values())if(room.hostSocketId===socket.id){room.hostConnected=false;emitRoom(room);}const code=socket.data.roomCode,id=socket.data.playerId,room=code&&rooms.get(code);if(room&&id&&room.players.has(id)){room.players.get(id).connected=false;emitRoom(room);}});
});
server.listen(PORT,()=>console.log(`Quiz Buzzer running on port ${PORT}`));
