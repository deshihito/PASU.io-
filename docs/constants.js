// ===== PASU.io 共通定数 =====

const CONSTANTS = {
  // ゲームワールド
  BLOCK_SIZE: 40,
  GAME_WIDTH: 3000,
  GAME_HEIGHT: 800,
  
  // プレイヤー
  PLAYER_W: 50,
  PLAYER_H: 36,
  GRAVITY: 0.6,
  
  // フック
  HOOK_SPEED: 25,
  HOOK_MAX_LEN: 500,
  HOOK_COOLDOWN: 15,
  
  // ハンド
  HAND_SPEED: 20,
  HAND_MAX_LEN: 300,
  
  // 弾
  BULLET_SPEED: 12,
  BULLET_LIFE: 120,
  
  // 帰還
  RETURN_TIME: 180, // 3秒 (60fps)
  
  // 無敵時間
  SPAWN_INVINCIBLE: 120, // 2秒
  
  // ブロック種類
  BLOCK_EMPTY: 0,
  BLOCK_WALL: 1,
  BLOCK_ICE: 2,
  BLOCK_JUMP: 3,
  BLOCK_BUSH: 4,
  BLOCK_SPIKE: 5,
  BLOCK_WIND_LEFT: 6,
  BLOCK_WIND_RIGHT: 7,
  BLOCK_WIND_UP: 8,
  BLOCK_DARKNESS: 9,
  BLOCK_COLLAPSE: 10,
  BLOCK_HEAL: 11,
  
  // 武器種類
  WEAPON_SPAGHETTI_GUN: 'spaghetti_gun',
  WEAPON_MACARONI_LAUNCHER: 'macaroni_launcher',
  WEAPON_PENNE_SHOTGUN: 'penne_shotgun',
  WEAPON_RAVIOLI_GRENADE: 'ravioli_grenade',
  WEAPON_FETTUCCINE_WHIP: 'fettuccine_whip',
  WEAPON_MISSILE: 'missile',
  
  // サブウェポン
  SUB_OLIVE_HEAL: 'olive_heal',
  SUB_CHEESE_SMOKE: 'cheese_smoke',
  SUB_PEPERONCINO_BOOST: 'peperoncino_boost',
  SUB_SHIELD: 'shield',
  SUB_TRAP: 'trap',
  
  // ゲームモード
  MODE_DEATHMATCH: 'deathmatch',
  MODE_TEAM_BATTLE: 'team_battle',
  MODE_KING_OF_HILL: 'king_of_hill',
  MODE_CAPTURE_FLAG: 'capture_flag',
  MODE_BATTLE_ROYALE: 'battle_royale',
  MODE_ZOMBIE: 'zombie',
  
  // チーム
  TEAM_NONE: 0,
  TEAM_RED: 1,
  TEAM_BLUE: 2,
  
  // チャージ
  CHARGE_MAX: 60,
  
  // ミサイル
  MISSILE_SPEED: 8,
  MISSILE_TURN: 0.05,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
