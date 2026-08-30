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
  
  // フック（改善版）
  HOOK_SPEED: 25,
  HOOK_MAX_LEN: 500,
  HOOK_COOLDOWN: 5, // フック連続使用に短い猶予
  HOOK_PIERCE_FIX: true, // フック貫通バグ修正フラグ
  
  // ハンド
  HAND_SPEED: 20,
  HAND_MAX_LEN: 300, // 400 → 300に短縮
  HAND_PENETRATION_FIX: true, // 壁貫通修正
  
  // 弾（調整版）
  BULLET_SPEED: 13, // 15 → 13に遅延（避けやすく）
  BULLET_LIFE: 120,
  BULLET_KNOCKBACK: 0.5, // ノックバック強化係数
  
  // 帰還
  RETURN_TIME: 180, // 3秒 (60fps)
  RETURN_CANCEL: true, // 帰還中に再びHキーでキャンセル可能
  
  // 無敵時間（強化）
  SPAWN_INVINCIBLE: 120, // 2秒
  SPAWN_INVINCIBLE_DURATION: 120, // リスポーン後無敵時間
  
  // 操作感（新機能）
  COYOTE_TIME: 6, // 崖から落下後、6フレーム以内ならジャンプ可能
  INPUT_BUFFER_SIZE: 10, // 入力バッファサイズ
  CHARGE_SHOT_MAX: 60, // チャージショット最大フレーム
  
  // ブッシュ速度調整
  BUSH_SPEED_MULT: 0.7, // ブッシュ内は70%の速度
  
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
  
  // 武器種類
  WEAPON_SPAGHETTI_GUN: 'spaghetti_gun',
  WEAPON_MACARONI_LAUNCHER: 'macaroni_launcher',
  WEAPON_PENNE_SHOTGUN: 'penne_shotgun',
  WEAPON_RAVIOLI_GRENADE: 'ravioli_grenade',
  WEAPON_FETTUCCINE_WHIP: 'fettuccine_whip',
  
  // サブウェポン
  SUB_OLIVE_HEAL: 'olive_heal',
  SUB_CHEESE_SMOKE: 'cheese_smoke',
  SUB_PEPERONCINO_BOOST: 'peperoncino_boost',
  
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
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
