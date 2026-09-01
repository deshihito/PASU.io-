# Game Plan: PASU.io Vector Pasta Party

## Current hook contract

フック／ハンドが唯一の基本アクション。プレイヤーがゲーム画面をクリックすると、照準方向のターゲットへ麺を一度だけ発射して接続する。接続後、クリックを押し続けている間のマウス移動だけが張力と移動方向を更新し、クリックを離すと接続を解除する。

## Target rules

| 対象 | 接続後の挙動 |
|---|---|
| 不動態 | 壁・床・天井・固定足場など全ての固定矩形の面。プレイヤー自身へ張力を適用する |
| 動態 | 箱・ハンマー・銃・石ころ。対象物へ張力を適用し、速度と重量で動かす |
| プレイヤー | 相手の位置へ追従する接続。双方に反作用を適用する |

## Risk tasks

### 1. 発射と接続の分離

`pointerdown` で照準を確定して接続を開始し、`pointermove` は接続後の張力操作だけに使う。サーバー側では `player.hook` が存在する間は対象を再選択しない。

### 2. タッチ長押しのブラウザ干渉

ゲームCanvasに `touch-action: none`、`user-select: none`、`-webkit-touch-callout: none` を適用し、touchstart・touchmove・touchend・touchcancel・contextmenu・selectstartを明示的に抑止する。名前入力とルームコード入力はゲームCanvas外なので通常どおり残す。

## Main build

`docs/game.js` は基本入力を `hook`、`aimX`、`aimY` のみにし、Socket.IOへ50ms周期で送る。`server/server.js` の `hookTarget` はクリック位置までの線分と、壁・床・天井・固定足場など全ての固定矩形、動態オブジェクト、プレイヤーの矩形が交差した場合だけ接続する。`updateHook` は接続対象を保持し、フック最大距離760、最大力2.6を超えない範囲で、対象種別に応じて力を分配する。

## Verification criteria

- `node --check server/server.js` と `node --check docs/game.js` が成功する。
- `pointerdown`、接続中の`pointermove`、`pointerup`、touch解除で入力が破綻しない。
- 旧来の `grab`、`use`、Space、ハンド専用アクションがクライアントと説明文に残っていない。
- 3種類のターゲットへ向けた分岐がサーバーに存在し、プレイヤー対象への反作用が維持される。
- ローカルサーバーの `/` と `?demo` が応答し、`git diff --check` が成功する。
