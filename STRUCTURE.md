# Structure: PASU.io Vector Pasta Party

## Input model

クライアントから送る基本入力は `hook`、`aimX`、`aimY` の3つだけ。`pointerdown` は照準を更新して麺の発射と接続を開始し、接続中の `pointermove` はマウス位置だけを更新する。`pointerup`、`pointercancel`、`lostpointercapture`、windowの `blur`、touchend、touchcancelで接続を解除する。

## Target model

| 種類 | サーバー側の識別 | 力の適用先 |
|---|---|---|
| 不動態 | `terrain` | プレイヤー自身 |
| 動態 | `object` | 対象オブジェクト |
| プレイヤー | `player` | プレイヤー自身と対象プレイヤー |

`hookTarget` はクリック位置までの線分と、壁・床・天井・固定足場など全ての固定矩形、動態オブジェクト、他プレイヤーの矩形が交差したときだけ対象を候補化する。候補は線分の始点から近い順に選び、仮想的なアンカー点は生成しない。接続後は `player.hook` に対象を保持し、接続中に候補を再選択しない。

## Data models

### Player

`id`、`name`、`color`、`x`、`y`、`vx`、`vy`、`w`、`h`、`hp`、`score`、`fallCount`、`hook`、`input` を持つ。`input` はフックの押下状態とマウス座標だけで、歩行・ジャンプ・攻撃専用入力はない。フックの最大距離は760、最大力は8、動態オブジェクト操作係数は2.2に制限する。プレイヤーと動態オブジェクトの上端は天井Y=40で停止する。

### InteractiveObject

`id`、`x`、`y`、`w`、`h`、`vx`、`vy`、`weight`、`kind`、`effect`、`angle` を持つ。ハンマーは重量4.8、銃は0.8、石ころは1.2。PvPではフックで移動させ、速度と重量から接触ダメージを計算する。上方向のフック力も対象物の`vy`へ適用し、天井Y=40で反射せず停止する。

### Room / Map

Roomは `id`、`hostId`、`seed`、`mode`、`started`、`ended`、`startedAt`、`endedAt`、`winnerId`、`endReason`、`players`、`map` を持つ。Mapは `18000 × 9800` のワールドに、床・天井・壁、モード別の固定地形、18ランドマーク、6道具、30アイテム、専用スポーン地点を含む。

## Client structure

`docs/index.html` は余計な操作説明を置かず、モード選択・ルームコード・最小HUD・接続状態の円形アイコンだけを表示する。`docs/style.css` はゲーム領域へ `touch-action: none`、`user-select: none`、`-webkit-touch-callout: none` を設定する。`docs/game.js` はCanvas上の円・線・矩形・多角形描画とSocket.IO同期を担当する。

## Rules and round state

`MODE_RULES` は各モードのルール、目標値、制限時間、勝利条件を持つ。TAGは5タッチ、HIDEは隠れ30秒、FREEは20ポイント、HILLは頂上滞在30秒、PVPは最後の1人を勝利とし、制限時間到達時はモード別の累計値で判定する。`updateRound` が目標到達または時間切れを検知し、`roundEnd` と `room.ended` を配信する。

## Map variation and online placement

`MODE_LAYOUTS`、`MODE_SPAWNS`、`MODE_OBJECTS` はモードごとに別定義を持つ。地形は固定の外壁・床・天井だけでなく、段差、縦壁、ゲート、天井付きの部屋、狭い通路、分岐、囲い、登坂を組み合わせる。`makeArena` はモードのレイアウトとseed由来の散在足場を結合する。

`spawnPointFor` は既存プレイヤーを除いた占有位置から180ワールド単位以上離れたモード専用地点を選ぶ。候補が満杯の場合はグリッド上の安全地点へフォールバックする。新規参加時と落下後の復帰時に同じ処理を利用するため、オンライン開始時の重複を避ける。

クライアントは右上の `miniMap` Canvasへ、固定地形・動態オブジェクト・全プレイヤー・現在のカメラ視界を縮小して描画する。メインCanvasと同じサーバー状態を使い、別の地形データを持たない。
