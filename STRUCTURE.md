# Structure: Past.io Party

## Data Models

### Player
- `id`: Socket ID
- `x, y, vx, vy`: 位置と速度
- `hook`: `{ active, targetId, targetType, length, angle }`
- `score`: 拾い物取得数
- `roomId`: 所属ルーム

### Room
- `id`: ルームコード
- `seed`: マップ生成用シード
- `players`: プレイヤーIDリスト
- `items`: `{ id, x, y, type, collected }`
- `platforms`: `{ x, y, w, h }` (seedから生成)

### Input
- `move`: -1, 0, 1 (左右)
- `jump`: boolean
- `hook`: boolean (長押し継続)

## Architecture

### Server (Node.js + Socket.io)
- `server.js`: ループとSocket通信
- `game/room-manager.js`: ルーム作成・参加・退出
- `game/map-generator.js`: seedベースの足場・拾い物生成
- `game/physics.js`: フック牽引、衝突判定、拾い物取得

### Client (React + Canvas)
- `App.tsx`: ホームとルームの画面遷移
- `GameCanvas.tsx`: Canvas描画と入力送信
- `game/renderer.js`: 足場、プレイヤー、フック、拾い物の描画
- `game/input-handler.js`: キーボードとマウス長押しの検知

## Communication Protocol
- `joinRoom(roomId)` -> `roomJoined(state)`
- `input(state)` (60fps)
- `state(world)` (60fps)
- `itemCollected(itemId, playerId)`
- `playerJoined/Left`
