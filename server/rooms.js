const C = require('../shared/constants');

// ===== ルーム管理 =====
const rooms = {};

function createRoom(id, mode = C.MODE_DEATHMATCH, maxPlayers = 8) {
  return {
    id,
    mode,
    maxPlayers,
    players: [],
    teams: { [C.TEAM_RED]: [], [C.TEAM_BLUE]: [] },
    scores: {},
    killLog: [],
    matchStarted: false,
    matchEnded: false,
    startTime: 0,
    endTime: 0,
    timeLimit: 300, // 5分
    scoreLimit: 20,
    hillArea: { x: 1400, y: 400, w: 200, h: 200 }, // KOTH用
    hillTimer: {},
    flags: { [C.TEAM_RED]: { x: 200, y: 500, heldBy: null }, [C.TEAM_BLUE]: { x: 2800, y: 500, heldBy: null } },
    safeZone: { x: 0, y: 0, w: 3000, h: 800 }, // BR用
    safeZoneShrink: 0,
    zombie: null, // ゾンビモード用
    smokeScreens: [] // チーズスモーク
  };
}

function getOrCreateRoom(mode = C.MODE_DEATHMATCH) {
  // 空きルームを探す
  for (const id in rooms) {
    const room = rooms[id];
    if (room.mode === mode && room.players.length < room.maxPlayers && !room.matchStarted) {
      return room;
    }
  }
  // 新規作成
  const newId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  rooms[newId] = createRoom(newId, mode);
  return rooms[newId];
}

function joinRoom(socketId, room, team = C.TEAM_NONE) {
  if (room.players.length >= room.maxPlayers) return false;
  if (room.matchStarted) return false;
  
  room.players.push(socketId);
  room.scores[socketId] = { kills: 0, deaths: 0, assists: 0, points: 0 };
  
  // チーム分け
  if (room.mode === C.MODE_TEAM_BATTLE || room.mode === C.MODE_CAPTURE_FLAG) {
    if (team === C.TEAM_NONE) {
      // 少ない方に自動割り当て
      const redCount = room.teams[C.TEAM_RED].length;
      const blueCount = room.teams[C.TEAM_BLUE].length;
      team = redCount <= blueCount ? C.TEAM_RED : C.TEAM_BLUE;
    }
    room.teams[team].push(socketId);
  }
  
  return true;
}

function leaveRoom(socketId, room) {
  const idx = room.players.indexOf(socketId);
  if (idx !== -1) room.players.splice(idx, 1);
  
  // チームからも削除
  for (const teamId in room.teams) {
    const tIdx = room.teams[teamId].indexOf(socketId);
    if (tIdx !== -1) room.teams[teamId].splice(tIdx, 1);
  }
  
  // フラグ持ちなら落とす
  for (const teamId in room.flags) {
    if (room.flags[teamId].heldBy === socketId) {
      room.flags[teamId].heldBy = null;
    }
  }
  
  // ゾンビが抜けたら終了
  if (room.mode === C.MODE_ZOMBIE && room.zombie === socketId) {
    room.matchEnded = true;
  }
}

function startMatch(room) {
  if (room.matchStarted) return;
  room.matchStarted = true;
  room.startTime = Date.now();
  
  // ゾンビモード：最初のゾンビをランダム選択
  if (room.mode === C.MODE_ZOMBIE) {
    room.zombie = room.players[Math.floor(Math.random() * room.players.length)];
  }
}

function endMatch(room) {
  room.matchEnded = true;
  room.endTime = Date.now();
}

function addKillLog(room, killer, victim, weapon = 'default') {
  room.killLog.unshift({ killer, victim, weapon, time: Date.now() });
  if (room.killLog.length > 10) room.killLog.pop();
}

function checkWinCondition(room) {
  if (!room.matchStarted || room.matchEnded) return null;
  
  const elapsed = (Date.now() - room.startTime) / 1000;
  
  switch (room.mode) {
    case C.MODE_DEATHMATCH:
      for (const id in room.scores) {
        if (room.scores[id].kills >= room.scoreLimit) return id;
      }
      if (elapsed >= room.timeLimit) {
        // 時間切れ：最多キル者
        let maxKills = -1;
        let winner = null;
        for (const id in room.scores) {
          if (room.scores[id].kills > maxKills) {
            maxKills = room.scores[id].kills;
            winner = id;
          }
        }
        return winner;
      }
      break;
      
    case C.MODE_TEAM_BATTLE:
      for (const teamId in room.teams) {
        let teamKills = 0;
        for (const pid of room.teams[teamId]) {
          teamKills += room.scores[pid]?.kills || 0;
        }
        if (teamKills >= room.scoreLimit) return teamId;
      }
      break;
      
    case C.MODE_KING_OF_HILL:
      // ポイント制限チェック
      for (const id in room.scores) {
        if (room.scores[id].points >= 100) return id;
      }
      break;
      
    case C.MODE_CAPTURE_FLAG:
      for (const teamId in room.teams) {
        let captures = 0;
        for (const pid of room.teams[teamId]) {
          captures += room.scores[pid]?.captures || 0;
        }
        if (captures >= 3) return teamId;
      }
      break;
      
    case C.MODE_ZOMBIE:
      // 全員感染でゾンビ勝利、時間切れで生存者勝利
      const survivors = room.players.filter(p => p !== room.zombie);
      if (survivors.length === 0) return room.zombie;
      if (elapsed >= 180) return 'survivors';
      break;
      
    case C.MODE_BATTLE_ROYALE:
      if (room.players.length <= 1) return room.players[0];
      break;
  }
  
  return null;
}

function updateKOTH(room, players) {
  if (room.mode !== C.MODE_KING_OF_HILL) return;
  
  const hill = room.hillArea;
  for (const id in players) {
    const p = players[id];
    if (!room.players.includes(id)) continue;
    if (p.x + p.width > hill.x && p.x < hill.x + hill.w &&
        p.y + p.height > hill.y && p.y < hill.y + hill.h) {
      room.scores[id].points = (room.scores[id].points || 0) + 0.1;
    }
  }
}

function updateBR(room) {
  if (room.mode !== C.MODE_BATTLE_ROYALE) return;
  
  const elapsed = (Date.now() - room.startTime) / 1000;
  const shrinkRate = 0.5; // 1秒あたり縮小量
  
  room.safeZoneShrink += shrinkRate;
  room.safeZone.x += shrinkRate;
  room.safeZone.y += shrinkRate;
  room.safeZone.w -= shrinkRate * 2;
  room.safeZone.h -= shrinkRate * 2;
  
  // 安全圏外ダメージ
  for (const id in room.players) {
    const p = room.players[id];
    if (p.x < room.safeZone.x || p.x + p.width > room.safeZone.x + room.safeZone.w ||
        p.y < room.safeZone.y || p.y + p.height > room.safeZone.y + room.safeZone.h) {
      if (p.invincible <= 0) {
        p.hp -= 2;
        p.invincible = 30;
      }
    }
  }
}

function getRoomState(room) {
  return {
    id: room.id,
    mode: room.mode,
    players: room.players.length,
    maxPlayers: room.maxPlayers,
    started: room.matchStarted,
    ended: room.matchEnded,
    scores: room.scores,
    killLog: room.killLog,
    teams: room.teams,
    timeRemaining: room.matchStarted ? Math.max(0, room.timeLimit - Math.floor((Date.now() - room.startTime) / 1000)) : room.timeLimit
  };
}

module.exports = {
  rooms,
  createRoom,
  getOrCreateRoom,
  joinRoom,
  leaveRoom,
  startMatch,
  endMatch,
  addKillLog,
  checkWinCondition,
  updateKOTH,
  updateBR,
  getRoomState
};
