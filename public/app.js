const socket = io();
const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
const connectionLabel = document.getElementById("connection-label");
let current = { role: null, code: null, token: null, playerId: null, state: null, questions: [], shuffled: false };
let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.classList.remove("show"),3000); }
socket.on("connect",()=>{connectionLabel.textContent="Đã kết nối";});
socket.on("disconnect",()=>{connectionLabel.textContent="Mất kết nối";});
socket.on("connect_error",()=>{connectionLabel.textContent="Đang kết nối lại";});
socket.on("app:error",toast);
socket.on("room:created",data=>{
  current.role="host";current.code=data.code;current.token=data.hostToken;current.state=data.state;
  localStorage.setItem("qb_host_"+data.code,data.hostToken);
  history.replaceState({}, "", `/?view=host&room=${data.code}`);
  renderLive();
});
socket.on("buzz:rejected",toast);
socket.on("buzz:accepted",()=>toast("Bạn đã giành được quyền trả lời!"));

function home(){
 current.role=null;current.code=null;current.state=null;
 app.innerHTML=`<section class="hero"><div class="eyebrow">ĐẤU TRƯỜNG TRI THỨC TRỰC TUYẾN</div><h1>Mỗi câu hỏi,<br><span>một cơ hội tỏa sáng.</span></h1><p>Tạo phòng thi, mời thí sinh tham gia và điều khiển cuộc chơi theo thời gian thực.</p></section>
 <section class="home-grid"><article class="panel"><div class="panel-icon">✦</div><h2>Dành cho MC</h2><p>Tạo phòng, nhập đề và điều khiển toàn bộ cuộc thi.</p><button class="btn btn-primary full" id="go-host">Tạo phòng thi <span>→</span></button></article><article class="panel"><div class="panel-icon">⌁</div><h2>Dành cho thí sinh</h2><p>Nhập mã phòng hoặc sử dụng đường link được chia sẻ.</p><button class="btn btn-outline full" id="go-player">Tham gia phòng <span>→</span></button></article></section><div class="home-note">Không cần cài đặt · Dùng được trên điện thoại, máy tính và máy tính bảng</div>`;
 document.getElementById("go-host").onclick=hostSetup;
 document.getElementById("go-player").onclick=playerJoin;
}
function hostSetup(){
 current.role="setup";current.questions=[];
 app.innerHTML=`<a href="/" class="back" id="back-home">← Trang chủ</a><div class="view-head"><div><h1>Tạo phòng thi</h1><p>Nhập bộ câu hỏi, kiểm tra nội dung rồi tạo phòng.</p></div><span class="pill blue">Tối đa 500 câu</span></div>
 <div class="layout"><div class="stack"><section class="card"><h3>1. Nhập bộ câu hỏi</h3><div class="tabs"><button class="tab active" data-tab="manual">Nhập thủ công</button><button class="tab" data-tab="excel">Tải Excel</button></div>
 <div id="manual-pane"><div class="field"><label>NỘI DUNG CÂU HỎI VÀ ĐÁP ÁN</label><textarea id="manual-input" placeholder="[Thủ đô Việt Nam?]|[Hà Nội] [Tác giả Truyện Kiều?]|[Nguyễn Du]"></textarea><div class="hint">Cú pháp: [Câu hỏi]|[Câu trả lời] [Câu hỏi tiếp theo]|[Câu trả lời]. Không cần đánh số. Nội dung nằm ngoài dấu ngoặc vuông sẽ bị bỏ qua.</div></div><button class="btn btn-soft" id="parse-manual">Đọc và xem trước câu hỏi</button></div>
 <div id="excel-pane" class="hidden"><div class="filebox"><div style="font-size:26px;margin-bottom:8px">▤</div><strong>Chọn tệp Excel</strong><p class="hint">Tệp .xlsx hoặc .xls có 3 cột: STT | Câu hỏi | Câu trả lời</p><input id="excel-file" type="file" accept=".xlsx,.xls,.csv"></div><div class="hint" style="margin-top:10px">Hệ thống đọc tên cột tiếng Việt hoặc theo thứ tự 3 cột. Dòng tiêu đề được tự nhận diện.</div></div>
 </section><section class="card"><div class="view-head" style="margin-bottom:12px"><div><h3 style="margin:0">2. Kiểm tra bộ câu hỏi</h3><span class="hint" id="q-count">Chưa có câu hỏi</span></div><button class="btn btn-small btn-outline" id="clear-questions">Xóa tất cả</button></div><div class="question-list" id="question-list"><div class="hint">Câu hỏi sau khi nhập sẽ xuất hiện tại đây.</div></div></section></div>
 <aside class="stack"><section class="card"><h3>3. Cài đặt cuộc thi</h3><label class="toggle"><input type="checkbox" id="shuffle"> Xáo trộn thứ tự câu hỏi</label><div class="divider"></div><div class="hint">Luật mặc định</div><div class="player-row"><span>Thời gian chờ chuông</span><strong>15 giây</strong></div><div class="player-row"><span>Thời gian trả lời</span><strong>5 giây</strong></div><div class="player-row"><span>Trả lời đúng</span><strong style="color:var(--green)">+10 điểm</strong></div><div class="player-row"><span>Trả lời sai / quá giờ</span><strong style="color:var(--red)">−5 điểm</strong></div><p class="footer-note">Điểm tối thiểu 0. MC xác nhận đúng/sai và điều khiển từng bước. Mỗi lượt câu hỏi chỉ có một lần bấm chuông.</p><button class="btn btn-primary full" id="create-room" disabled>Tạo phòng thi <span>→</span></button></section></aside></div>`;
 document.getElementById("back-home").onclick=e=>{e.preventDefault();home();};
 document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));document.getElementById("manual-pane").classList.toggle("hidden",t.dataset.tab!=="manual");document.getElementById("excel-pane").classList.toggle("hidden",t.dataset.tab!=="excel");});
 document.getElementById("parse-manual").onclick=()=>{
  const raw=document.getElementById("manual-input").value;
  const tokens=[...raw.matchAll(/\[([^\]]*)\]/g)].map(m=>m[1].trim());
  if(tokens.length%2!==0){toast("Số cặp dấu ngoặc chưa hợp lệ. Mỗi câu hỏi cần một đáp án.");return;}
  const qs=[];for(let i=0;i<tokens.length;i+=2){if(tokens[i]&&tokens[i+1])qs.push({question:tokens[i],answer:tokens[i+1]});}
  setQuestions(qs);
 };
 document.getElementById("excel-file").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
   if(!window.XLSX)throw new Error("Không tải được thư viện đọc Excel. Hãy kiểm tra kết nối Internet.");
   const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
   if(!rows.length)throw new Error("Tệp không có dữ liệu.");
   const norm=s=>String(s??"").trim().toLocaleLowerCase("vi");
   const header=rows[0].map(norm);
   let qi=header.findIndex(x=>x.includes("câu hỏi")||x==="question");
   let ai=header.findIndex(x=>x.includes("câu trả lời")||x==="đáp án"||x==="answer");
   let si=header.findIndex(x=>x==="stt"||x.includes("số thứ tự"));
   let start=0;
   if(qi>=0&&ai>=0)start=1;else{qi=1;ai=2;si=0;}
   const qs=rows.slice(start).map(r=>({question:String(r[qi]??"").trim(),answer:String(r[ai]??"").trim()})).filter(x=>x.question&&x.answer);
   if(!qs.length)throw new Error("Không tìm thấy dữ liệu ở cột Câu hỏi và Câu trả lời.");
   setQuestions(qs);toast("Đã đọc "+qs.length+" câu hỏi.");
  }catch(err){toast(err.message);}
 };
 document.getElementById("clear-questions").onclick=()=>setQuestions([]);
 document.getElementById("create-room").onclick=()=>{
  if(!current.questions.length)return;
  let qs=[...current.questions];if(document.getElementById("shuffle").checked)qs.sort(()=>Math.random()-.5);
  socket.emit("room:create",{questions:qs});
 };
}
function setQuestions(qs){
 current.questions=qs.slice(0,500);
 const list=document.getElementById("question-list");const count=document.getElementById("q-count");const create=document.getElementById("create-room");
 if(!list)return;
 count.textContent=current.questions.length+" câu hỏi hợp lệ";
 create.disabled=!current.questions.length;
 list.innerHTML=current.questions.length?current.questions.map((q,i)=>`<div class="question-item"><div class="qnum">${i+1}</div><div><strong>${esc(q.question)}</strong><small>Đáp án: ${esc(q.answer)}</small></div><button class="btn btn-small btn-danger" data-remove="${i}">×</button></div>`).join(""):'<div class="hint">Chưa có câu hỏi.</div>';
 list.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>setQuestions(current.questions.filter((_,i)=>i!==Number(b.dataset.remove))));
}
function playerJoin(prefill=""){
 current.role="join";
 app.innerHTML=`<div class="join-box"><a href="/" class="back" id="back-home">← Trang chủ</a><section class="card"><div class="join-title"><div class="panel-icon" style="margin:0 auto 13px">⌁</div><h1>Tham gia cuộc thi</h1><p>Nhập mã phòng và tên hiển thị của bạn.</p></div><div class="field"><label>MÃ PHÒNG</label><input id="room-code" maxlength="6" placeholder="VD: A2BC9D" value="${esc(prefill)}" style="text-transform:uppercase;text-align:center;letter-spacing:.2em;font-size:20px;font-weight:800"></div><div class="field"><label>TÊN THÍ SINH</label><input id="player-name" maxlength="24" placeholder="Nhập tên của bạn"></div><button class="btn btn-primary full" id="join-room">Vào phòng thi →</button><p class="footer-note center">Tên hiển thị cần khác với các thí sinh khác trong cùng phòng.</p></section></div>`;
 document.getElementById("back-home").onclick=e=>{e.preventDefault();home();};
 document.getElementById("room-code").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
 document.getElementById("join-room").onclick=()=>{const code=document.getElementById("room-code").value.trim();const name=document.getElementById("player-name").value.trim();if(code.length!==6||!name)return toast("Hãy nhập mã phòng gồm 6 ký tự và tên của bạn.");socket.emit("player:join",{code,name});};
}
function renderLive(){
 if(!current.state)return;
 if(current.role==="host")renderHost();
 if(current.role==="player")renderPlayer();
 if(current.role==="screen")renderScreen();
}
function scoresHTML(players){return players.map((p,i)=>`<div class="score-row"><div><span class="qnum" style="display:inline-grid;margin-right:8px">${i+1}</span><span class="player-name">${esc(p.name)}</span><div class="hint" style="display:inline;margin-left:6px">${p.connected?"":"· mất kết nối"}</div></div><span class="score">${p.score}</span></div>`).join("")||'<div class="hint">Chưa có thí sinh.</div>'}
function phaseLabel(s){
 return ({lobby:"Đang chờ thí sinh",ready:"Sẵn sàng",question:"Đang mở chuông",buzzed:"Đã có người giành chuông",timeout_pending:"Hết giờ trả lời – chờ MC xác nhận",no_buzz:"Không có người bấm chuông",resolved:"Đã xác nhận kết quả",finished:"Cuộc thi kết thúc"})[s.phase]||s.phase;
}
function hostAction(event){socket.emit(event,{code:current.code,token:current.token});}
function renderHost(){
 const s=current.state;const players=s.players;
 const canMark=["buzzed","timeout_pending"].includes(s.phase);
 const canResolve=["no_buzz","resolved"].includes(s.phase);
 app.innerHTML=`<a class="back" href="/">← Trang chủ</a><div class="view-head"><div><h1>Bảng điều khiển MC</h1><p>Phòng <strong>${s.code}</strong> · ${s.questionIndex+1}/${s.questionsCount} câu</p></div><div class="toolbar"><span class="pill ${s.hostConnected?"green":"red"}">${s.hostConnected?"MC trực tuyến":"MC mất kết nối"}</span><button class="btn btn-outline btn-small" id="open-screen">Màn hình trình chiếu ↗</button></div></div>
 <div class="connection-lost ${s.hostConnected?"hidden":""}">Kết nối MC bị gián đoạn. Đang thử kết nối lại…</div>
 <div class="layout"><div class="stack"><section class="question-stage"><div class="stage-meta"><span>CÂU ${s.questionIndex+1} / ${s.questionsCount}</span><span>${phaseLabel(s).toLocaleUpperCase("vi")}</span></div><div class="stage-question">${esc(s.question||"Chưa bắt đầu câu hỏi")}</div><div class="stage-footer"><span>${s.buzzedPlayerName?"ĐANG GIỮ QUYỀN: "+esc(s.buzzedPlayerName):"ĐẤU TRƯỜNG TRI THỨC"}</span><span class="timer" id="host-timer"></span></div></section>
 <section class="card"><h3>Điều khiển cuộc thi</h3><div class="host-actions">
 <button class="btn btn-primary" id="start-question" ${!["lobby","ready"].includes(s.phase)?"disabled":""}>▶ Mở câu hỏi / chuông</button>
 <button class="btn btn-soft" id="restart-question" ${!["no_buzz","resolved","timeout_pending"].includes(s.phase)?"disabled":""}>↻ Mở lại từ đầu</button>
 <button class="btn btn-success" id="mark-correct" ${(!canMark||s.phase==="timeout_pending")?"disabled":""}>✓ Xác nhận đúng (+10)</button>
 <button class="btn btn-danger" id="mark-wrong" ${!canMark?"disabled":""}>✕ Xác nhận sai (−5)</button>
 <button class="btn btn-outline" id="show-answer" ${!canResolve?"disabled":""}>◉ Hiện đáp án</button>
 <button class="btn btn-dark" id="next-question" ${!canResolve?"disabled":""}>Câu tiếp theo →</button>
 </div><div class="divider"></div><div class="result-banner info">${s.lastResult?`${esc(s.lastResult.playerName)} · ${s.lastResult.correct?"ĐÚNG +10":"SAI −5"}`:s.phase==="timeout_pending"?"Thí sinh đã hết 5 giây. MC cần xác nhận sai để trừ điểm.":s.phase==="no_buzz"?"Hết 15 giây, không có ai bấm chuông. MC quyết định bước tiếp theo.":"MC là người quyết định toàn bộ diễn biến."}</div>
 <div id="answer-box" class="${s.answerShown?"":"hidden"} result-banner good" style="margin-top:10px">ĐÁP ÁN: ${esc(s.answer||"")}</div>
 ${s.answerShown?"":""}</section>
 <section class="card"><h3>Mời thí sinh tham gia</h3><div class="qr-wrap"><div><div class="hint">MÃ PHÒNG</div><div class="room-code">${s.code}</div><button class="btn btn-small btn-soft" id="copy-link">Sao chép đường link</button></div><canvas id="qr"></canvas></div><div class="footer-note">Quét QR để vào phòng: ${location.origin}/?room=${s.code}</div></section></div>
 <aside class="stack"><section class="card"><div class="view-head" style="margin-bottom:10px"><div><h3 style="margin:0">Bảng điểm</h3><span class="hint">${players.length}/12 thí sinh</span></div><button class="btn btn-small btn-outline" id="reset-scores">Đặt lại điểm</button></div><div class="score-list">${scoresHTML(players)}</div></section><section class="card"><h3>Danh sách thí sinh</h3><div class="player-list">${players.map(p=>`<div class="player-row"><span><i class="status-dot ${p.connected?"":"off"}"></i><span class="player-name">${esc(p.name)}</span></span><button class="btn btn-small btn-danger" data-kick="${p.id}">Xóa</button></div>`).join("")||'<div class="hint">Đang chờ người tham gia…</div>'}</div></section><div class="footer-note">Host nhìn thấy toàn bộ thí sinh. Khi có trên 6 người, màn hình thí sinh và trình chiếu chỉ hiển thị 4 người dẫn đầu.</div></aside></div>`;
 document.getElementById("start-question").onclick=()=>hostAction("host:start-question");
 document.getElementById("restart-question").onclick=()=>hostAction("host:restart-question");
 document.getElementById("mark-correct").onclick=()=>socket.emit("host:mark",{code:current.code,token:current.token,correct:true});
 document.getElementById("mark-wrong").onclick=()=>socket.emit("host:mark",{code:current.code,token:current.token,correct:false});
 document.getElementById("show-answer").onclick=()=>hostAction("host:show-answer");
 document.getElementById("next-question").onclick=()=>hostAction("host:next");
 document.getElementById("reset-scores").onclick=()=>{if(confirm("Đặt điểm tất cả thí sinh về 0?"))hostAction("host:reset-scores");};
 document.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>{if(confirm("Xóa thí sinh này khỏi phòng?"))socket.emit("host:remove-player",{code:current.code,token:current.token,playerId:b.dataset.kick});});
 document.getElementById("open-screen").onclick=()=>window.open(`/?view=screen&room=${s.code}`,"_blank");
 document.getElementById("copy-link").onclick=()=>navigator.clipboard?.writeText(`${location.origin}/?room=${s.code}`).then(()=>toast("Đã sao chép đường link.")).catch(()=>toast("Không thể sao chép tự động."));
 drawQR(`${location.origin}/?room=${s.code}`);
 runTimer(s);
}
function runTimer(s){
 const el=document.getElementById("host-timer");if(!el)return;
 const deadline=s.phase==="question"?s.questionDeadline:s.phase==="buzzed"?s.answerDeadline:null;
 if(!deadline){el.textContent="";return;}
 const update=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));el.textContent=left<=3?String(left):"";};
 update();const timer=setInterval(()=>{if(!document.getElementById("host-timer"))return clearInterval(timer);update();},100);
}
function renderPlayer(){
 const s=current.state;const me=s.players.find(p=>p.id===current.playerId);const mayBuzz=s.phase==="question";
 const alreadyBuzzed=s.buzzedPlayerId===current.playerId;
 const leaderboard=s.players.length<=6?s.players:s.displayPlayers;
 let message=alreadyBuzzed?"Bạn đã giành quyền trả lời!":s.phase==="buzzed"||s.phase==="timeout_pending"?(s.buzzedPlayerName+" đang giữ quyền trả lời"):s.phase==="question"?"Chuông đang mở – hãy sẵn sàng!":s.phase==="no_buzz"?"Đã hết thời gian bấm chuông.":s.phase==="resolved"?"Lượt trả lời đã kết thúc.":s.phase==="finished"?"Cuộc thi đã kết thúc.":"Đang chờ MC điều khiển…";
 app.innerHTML=`<div class="view-head"><div><div class="eyebrow">QUIZ BUZZER · PHÒNG ${s.code}</div><h1>Xin chào, ${esc(me?.name||"thí sinh")}!</h1><p>${phaseLabel(s)} · Câu ${Math.min(s.questionIndex+1,s.questionsCount)}/${s.questionsCount}</p></div><span class="pill green">Đã tham gia</span></div>
 <div class="layout"><div class="stack"><section class="question-stage"><div class="stage-meta"><span>CÂU HỎI ${s.questionIndex+1}</span><span>${phaseLabel(s).toLocaleUpperCase("vi")}</span></div><div class="stage-question">${esc(s.question||"MC đang chuẩn bị câu hỏi…")}</div><div class="stage-footer"><span>${s.buzzedPlayerName?"NGƯỜI GIÀNH CHUÔNG: "+esc(s.buzzedPlayerName):"HÃY THEO DÕI HIỆU LỆNH CỦA MC"}</span><span class="timer" id="player-timer"></span></div></section>
 <section class="card center"><div class="buzzer-area"><button class="buzzer" id="buzzer" ${mayBuzz?"":"disabled"}>${mayBuzz?"CHUÔNG":"●"}</button></div><div class="buzzer-sub">${esc(message)}</div><div id="my-result" class="result-banner ${s.lastResult?.playerId===current.playerId?(s.lastResult.correct?"good":"bad"):"info"}" style="margin-top:13px">${s.lastResult?.playerId===current.playerId?(s.lastResult.correct?"Bạn trả lời đúng: +10 điểm.":"Bạn trả lời sai: −5 điểm."):"Điểm của bạn: "+(me?.score??0)}</div><div id="player-answer" class="${s.answerShown?"result-banner good":"hidden"}" style="margin-top:10px">ĐÁP ÁN: ${esc(s.answer||"")}</div></section></div>
 <aside class="stack"><section class="card"><h3>Bảng xếp hạng</h3><div class="score-list">${scoresHTML(leaderboard)}</div><div class="hint" style="margin-top:9px">${s.players.length>6?"Hiển thị 4 thí sinh dẫn đầu.": "Đang hiển thị toàn bộ thí sinh."}</div></section><section class="card"><h3>Điểm của bạn</h3><div class="score" style="font-size:34px;color:var(--blue)">${me?.score??0}</div><span class="hint">Điểm hiện tại</span></section></aside></div>`;
 document.getElementById("buzzer").onclick=()=>socket.emit("player:buzz",{code:current.code,playerId:current.playerId});
 runTimer(s);
}
function renderScreen(){
 const s=current.state;const leaderboard=s.players.length<=6?s.players:s.displayPlayers;
 app.innerHTML=`<div class="screen-shell"><div class="screen-title">QUIZ BUZZER · ĐẤU TRƯỜNG TRI THỨC <span style="float:right">PHÒNG ${s.code}</span></div><div class="screen-layout"><div class="screen-main"><section class="question-stage"><div class="stage-meta"><span>CÂU ${s.questionIndex+1} / ${s.questionsCount}</span><span>${phaseLabel(s).toLocaleUpperCase("vi")}</span></div><div class="stage-question">${esc(s.question||"CHỜ MC BẮT ĐẦU")}</div><div class="stage-footer"><span>${s.buzzedPlayerName?"NGƯỜI GIÀNH QUYỀN: "+esc(s.buzzedPlayerName):"ĐẤU TRƯỜNG TRI THỨC"}</span><span class="timer" id="screen-timer"></span></div></section><div class="screen-status">${esc(s.lastResult?`${s.lastResult.playerName}: ${s.lastResult.correct?"CHÍNH XÁC!":"CHƯA CHÍNH XÁC"}`:s.buzzedPlayerName?`${s.buzzedPlayerName} ĐANG TRẢ LỜI`:phaseLabel(s))}</div>${s.answerShown?`<div class="result-banner good" style="font-size:18px;padding:20px">ĐÁP ÁN: ${esc(s.answer||"")}</div>`:""}</div><aside class="screen-side"><section class="card"><h3>BẢNG ĐIỂM</h3><div class="score-list">${scoresHTML(leaderboard)}</div><div class="hint" style="margin-top:10px">${s.players.length>6?"TOP 4 THÍ SINH":"TẤT CẢ THÍ SINH"}</div></section></aside></div></div>`;
 runTimer(s);
}
function drawQR(url){const c=document.getElementById("qr");if(c&&window.QRCode)QRCode.toCanvas(c,url,{width:112,margin:0,color:{dark:"#14243b",light:"#ffffff"}},err=>{if(err)console.warn(err);});}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function route(){
 const params=new URLSearchParams(location.search);const view=params.get("view");const room=(params.get("room")||"").toUpperCase();
 if(view==="screen"&&room){current.role="screen";current.code=room;app.innerHTML='<div class="center" style="padding:80px">Đang kết nối màn hình trình chiếu…</div>';socket.emit("screen:join",{code:room});return;}
 if(view==="host"&&room){const token=localStorage.getItem("qb_host_"+room);if(token){current.role="host";current.code=room;current.token=token;app.innerHTML='<div class="center" style="padding:80px">Đang kết nối lại bảng điều khiển…</div>';socket.emit("host:reconnect",{code:room,token});return;}}
 if(room){playerJoin(room);return;}
 home();
}
socket.on("player:joined",data=>{
 if(current.role==="screen") { current.playerId=data.playerId; current.state=data.state; renderScreen(); return; }
 current.role="player";current.code=data.code;current.playerId=data.playerId;current.state=data.state;
 const savedName=document.getElementById("player-name")?.value||"";
 localStorage.setItem("qb_player_"+data.code,JSON.stringify({id:data.playerId,name:savedName}));
 renderPlayer();
});
socket.on("room:update",state=>{
 current.state=state;
 if(current.role==="screen")renderScreen();else if(current.role==="host")renderHost();else if(current.role==="player")renderPlayer();
});
route();
