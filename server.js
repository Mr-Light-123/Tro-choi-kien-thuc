const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("*", (_req, res) => res.sendFile(process.cwd() + "/public/index.html"));

const makeCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};
const cleanName = (s) => String(s || "").trim().replace(/\s+/g, " ").slice(0, 24);
const publicRoom = (room) => {
  const players = [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, connected: p.connected
  }));
  const sorted = [...players].sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  const displayPlayers = players.length <= 6 ? sorted : sorted.slice(0,4);
  return {
    code: room.code,
    phase: room.phase,
    questionsCount: room.questions.length,
    questionIndex: room.questionIndex,
    question: room.questions[room.questionIndex]?.question || "",
    answer: room.answerShown ? (room.questions[room.questionIndex]?.answer || "") : null,
    answerShown: room.answerShown,
    questionDeadline: room.questionDeadline,
    answerDeadline: room.answerDeadline,
    buzzedPlayerId: room.buzzedPlayerId,
    buzzedPlayerName: room.buzzedPlayerId ? room.players.get(room.buzzedPlayerId)?.name || "Thí sinh" : null,
    lastResult: room.lastResult,
    players: sorted,
    displayPlayers,
    hostConnected: room.hostConnected
  };
};
function emitRoom(room) { io.to(room.code).emit("room:update", publicRoom(room)); }
function clearTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function setPhaseTimer(room, ms, callback) {
  clearTimer(room);
  room.timer = setTimeout(() => { room.timer = null; callback(); }, ms);
}
function hostCheck(socket, room, token) {
  if (!room || !token || token !== room.hostToken || room.hostSocketId !== socket.id) {
    socket.emit("app:error", "Bạn không có quyền điều khiển phòng này.");
    return false;
  }
  return true;
}
function sendSnapshot(socket, room) { socket.emit("room:update", publicRoom(room)); }

io.on("connection", socket => {
  socket.on("room:create", ({ questions } = {}) => {
    if (!Array.isArray(questions) || questions.length === 0 || questions.length > 500) {
      return socket.emit("app:error", "Hãy nhập ít nhất 1 câu hỏi (tối đa 500 câu).");
    }
    const valid = questions.map(q => ({
      question: String(q.question || "").trim().slice(0, 1000),
      answer: String(q.answer || "").trim().slice(0, 500)
    })).filter(q => q.question && q.answer);
    if (!valid.length) return socket.emit("app:error", "Không tìm thấy cặp câu hỏi và câu trả lời hợp lệ.");
    let code;
    do { code = makeCode(); } while (rooms.has(code));
    const room = {
      code, hostToken: crypto.randomBytes(24).toString("hex"), hostSocketId: socket.id,
      hostConnected: true, players: new Map(), questions: valid, questionIndex: 0,
      phase: "lobby", questionDeadline: null, answerDeadline: null,
      buzzedPlayerId: null, answerShown: false, lastResult: null, timer: null
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit("room:created", { code, hostToken: room.hostToken, state: publicRoom(room) });
    emitRoom(room);
  });

  socket.on("host:reconnect", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || token !== room.hostToken) return socket.emit("app:error", "Không tìm thấy phòng hoặc mã quản trị không hợp lệ.");
    if (room.hostSocketId && room.hostSocketId !== socket.id) {
      const old = io.sockets.sockets.get(room.hostSocketId);
      if (old) old.leave(room.code);
    }
    room.hostSocketId = socket.id; room.hostConnected = true;
    socket.join(room.code); sendSnapshot(socket, room); emitRoom(room);
  });

  socket.on("screen:join", ({ code } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("app:error", "Không tìm thấy phòng trình chiếu.");
    socket.data.screenRoom = room.code;
    socket.join(room.code);
    sendSnapshot(socket, room);
  });

  socket.on("player:join", ({ code, name, playerId } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("app:error", "Mã phòng không tồn tại. Hãy kiểm tra lại mã hoặc QR.");
    const playerName = cleanName(name);
    if (!playerName) return socket.emit("app:error", "Bạn hãy nhập tên trước khi tham gia.");
    let id = String(playerId || "");
    let player = id ? room.players.get(id) : null;
    if (!player) {
      if (room.players.size >= 12) return socket.emit("app:error", "Phòng đã đủ 12 thí sinh.");
      if ([...room.players.values()].some(p => p.name.toLocaleLowerCase() === playerName.toLocaleLowerCase())) {
        return socket.emit("app:error", "Tên này đã có người sử dụng trong phòng. Hãy chọn tên khác.");
      }
      id = crypto.randomUUID();
      player = { id, name: playerName, score: 0, connected: true, socketId: socket.id };
      room.players.set(id, player);
    } else {
      player.name = playerName; player.connected = true; player.socketId = socket.id;
    }
    socket.data.roomCode = room.code; socket.data.playerId = id;
    socket.join(room.code);
    socket.emit("player:joined", { playerId: id, code: room.code, state: publicRoom(room) });
    emitRoom(room);
  });

  socket.on("host:start-question", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (!room.players.size) return socket.emit("app:error", "Chưa có thí sinh nào tham gia.");
    if (room.questionIndex >= room.questions.length) return socket.emit("app:error", "Đã hết câu hỏi.");
    room.phase = "question"; room.questionDeadline = Date.now() + 15000;
    room.answerDeadline = null; room.buzzedPlayerId = null; room.answerShown = false; room.lastResult = null;
    setPhaseTimer(room, 15000, () => {
      if (room.phase === "question") { room.phase = "no_buzz"; room.questionDeadline = null; emitRoom(room); }
    });
    emitRoom(room);
  });

  socket.on("player:buzz", ({ code, playerId } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const player = room?.players.get(String(playerId || ""));
    if (!room || !player || player.socketId !== socket.id) return;
    if (room.phase !== "question" || Date.now() > room.questionDeadline) {
      return socket.emit("buzz:rejected", "Chuông hiện không mở.");
    }
    room.phase = "buzzed"; room.buzzedPlayerId = player.id;
    room.questionDeadline = null; room.answerDeadline = Date.now() + 5000;
    setPhaseTimer(room, 5000, () => {
      if (room.phase === "buzzed") { room.phase = "timeout_pending"; room.answerDeadline = null; emitRoom(room); }
    });
    emitRoom(room);
    socket.emit("buzz:accepted");
  });

  socket.on("host:mark", ({ code, token, correct } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (!["buzzed", "timeout_pending"].includes(room.phase) || !room.buzzedPlayerId) {
      return socket.emit("app:error", "Hiện không có lượt trả lời cần xác nhận.");
    }
    if (room.phase === "timeout_pending" && correct) {
      return socket.emit("app:error", "Thí sinh đã hết giờ; MC chỉ có thể xác nhận sai.");
    }
    clearTimer(room);
    const player = room.players.get(room.buzzedPlayerId);
    if (!player) return socket.emit("app:error", "Không tìm thấy thí sinh.");
    if (correct) {
      player.score += 10;
      room.lastResult = { playerId: player.id, playerName: player.name, correct: true, delta: 10 };
    } else {
      player.score = Math.max(0, player.score - 5);
      room.lastResult = { playerId: player.id, playerName: player.name, correct: false, delta: -5 };
    }
    room.phase = "resolved"; room.answerDeadline = null;
    emitRoom(room);
  });

  socket.on("host:show-answer", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (!["no_buzz", "resolved"].includes(room.phase)) {
      return socket.emit("app:error", "Hãy xác nhận kết quả lượt trả lời trước khi công bố đáp án.");
    }
    room.answerShown = true;
    emitRoom(room);
  });

  socket.on("host:next", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (!["no_buzz", "resolved"].includes(room.phase)) {
      return socket.emit("app:error", "Hãy xác nhận kết quả lượt trả lời trước khi chuyển câu.");
    }
    clearTimer(room);
    if (room.questionIndex + 1 >= room.questions.length) {
      room.phase = "finished"; room.questionDeadline = null; room.answerDeadline = null;
    } else {
      room.questionIndex++; room.phase = "ready"; room.questionDeadline = null;
      room.answerDeadline = null; room.buzzedPlayerId = null; room.answerShown = false; room.lastResult = null;
    }
    emitRoom(room);
  });

  socket.on("host:restart-question", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (!["no_buzz", "resolved"].includes(room.phase)) {
      return socket.emit("app:error", "Hãy xác nhận kết quả lượt trả lời trước khi mở lại câu hỏi.");
    }
    room.phase = "question"; room.questionDeadline = Date.now() + 15000;
    room.answerDeadline = null; room.buzzedPlayerId = null; room.answerShown = false; room.lastResult = null;
    setPhaseTimer(room, 15000, () => {
      if (room.phase === "question") { room.phase = "no_buzz"; room.questionDeadline = null; emitRoom(room); }
    });
    emitRoom(room);
  });

  socket.on("host:reset-scores", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    for (const p of room.players.values()) p.score = 0;
    emitRoom(room);
  });

  socket.on("host:remove-player", ({ code, token, playerId } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!hostCheck(socket, room, token)) return;
    if (room.buzzedPlayerId === playerId && ["buzzed", "timeout_pending"].includes(room.phase)) {
      return socket.emit("app:error", "Không thể xóa thí sinh đang giữ quyền trả lời.");
    }
    room.players.delete(playerId); emitRoom(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (room.hostSocketId === socket.id) { room.hostConnected = false; emitRoom(room); }
    }
    const code = socket.data.roomCode, id = socket.data.playerId;
    const room = code && rooms.get(code);
    if (room && id && room.players.has(id)) {
      room.players.get(id).connected = false;
      emitRoom(room);
    }
  });
});

server.listen(PORT, () => console.log(`Quiz Buzzer running on port ${PORT}`));
