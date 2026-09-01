# Structure: PASU.io Vector Pasta Party

## Data Models

### Player

`id`、`name`、`color`、`x`、`y`、`vx`、`vy`、`w`、`h`、`hp`、`score`、`fallCount`、`hook`、`heldObjectId`、`input` を持つ。`input` は `hook`、`grab`、`use`、`aimX`、`aimY` で、移動は麺フックの物理結果からのみ生じる。

### Room

`id`、`hostId`、`seed`、`mode`、`started`、`players`、`map` を持つ。`mode` は `tag`、`hide`、`free`、`hill`、`pvp` のいずれかで、公開状態には `modeLabel` と `goal` も含める。

### Map

`width: 18000`、`height: 9800`、`floorY`、`platforms`、`anchors`、`landmarks`、`objects`、`items` を持つ。マップはルームseedから決定的に生成し、現行比で横10倍・縦10倍の空間を、白い床・黄色い足場・赤い外周線で描画する。

### InteractiveObject

`id`、`x`、`y`、`w`、`h`、`vx`、`vy`、`weight`、`kind`、`effect`、`angle`、`heldBy` を持つ。`kind` は `hammer`、`gun`、`stone`。ハンマーは重量4.8、銃は重量0.8、石ころは重量1.2で、投擲速度と衝突ダメージへ反映する。

## Architecture

### Server (Node.js + Socket.IO)

`server.js` がルームライフサイクル、seedマップ生成、5モード状態、麺フック対象選択、道具の掴み・解除・投擲、重力・衝突・HP・スコアを担当する。ゲーム状態は50ms周期でルームへブロードキャストする。

### Client (HTML + Canvas)

`docs/index.html` がホーム、モード選択、ルーム、HUDの構造を持つ。`docs/style.css` は白・黄・赤・チャコールのフラットUIを担当する。`docs/game.js` はSocket.IOイベント、pointer入力、Canvas上のベクター描画、`?demo` 導線を担当する。

## Communication Protocol

- `createRoom({ name, mode })` → `roomJoined(state)`
- `joinRoom({ code, name })` → `roomJoined(state)`
- `startGame` → `state(world)`
- `input({ hook, grab, use, aimX, aimY })` → `state(world)`
- `state(world)` → 全クライアントへプレイヤー、マップ、道具を同期
- `itemCollected(itemId, playerId, score, value)` → 取得演出
- `playerHit(playerId, damage, objectId, effect)` → 被弾演出
