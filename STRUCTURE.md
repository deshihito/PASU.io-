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

`id`、`name`、`color`、`x`、`y`、`vx`、`vy`、`w`、`h`、`hp`、`score`、`fallCount`、`hook`、`input` を持つ。`input` はフックの押下状態とマウス座標だけで、歩行・ジャンプ・攻撃専用入力はない。フックの最大距離は760、最大力は2.6に制限する。

### InteractiveObject

`id`、`x`、`y`、`w`、`h`、`vx`、`vy`、`weight`、`kind`、`effect`、`angle` を持つ。ハンマーは重量4.8、銃は0.8、石ころは1.2。PvPではフックで移動させ、速度と重量から接触ダメージを計算する。

### Room / Map

Roomは `id`、`hostId`、`seed`、`mode`、`started`、`players`、`map` を持つ。Mapは `18000 × 9800` のワールドに、床・天井・壁、100個以上の固定足場、18ランドマーク、6道具、30アイテムを含む。

## Client structure

`docs/index.html` は余計な操作説明を置かず、モード選択・ルームコード・最小HUD・接続状態の円形アイコンだけを表示する。`docs/style.css` はゲーム領域へ `touch-action: none`、`user-select: none`、`-webkit-touch-callout: none` を設定する。`docs/game.js` はCanvas上の円・線・矩形・多角形描画とSocket.IO同期を担当する。
