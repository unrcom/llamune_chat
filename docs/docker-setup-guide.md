# llamune_chat Docker 起動ガイド

このガイドは、macOS（Appleシリコン）環境で llamune_chat を Docker で起動するための詳細な手順です。

## 📋 動作環境

- **OS**: macOS（Sonoma 14.0 以降推奨）
- **チップ**: Apple Silicon（M1 / M2 / M3 / M4）
- **メモリ**: 16GB 以上
- **ストレージ**: 20GB 以上の空き容量

---

## 1. Ollama のセットアップ

### 1.1 Ollama がインストールされているか確認

ターミナルを開いて、以下のコマンドを入力してください。

```bash
ollama --version
```

**成功した場合の表示例：**
```
ollama version is 0.5.4
```

**エラーの場合：**
```
command not found: ollama
```
→ Ollama がインストールされていません。<a href="https://ollama.com/" target="_blank">Ollama公式サイト</a> からダウンロードしてインストールしてください。

---

### 1.2 Ollama が起動しているか確認

```bash
curl http://localhost:11434/api/tags
```

**成功した場合の表示例：**
```json
{"models":[...]}
```

**エラーの場合：**
```
curl: (7) Failed to connect to localhost port 11434
```
→ Ollama が起動していません。

**起動方法：**
1. Finder で「アプリケーション」フォルダを開く
2. 「Ollama」をダブルクリック
3. メニューバーにラマのアイコン 🦙 が表示されるまで待つ

---

### 1.3 ダウンロード済みの LLM を確認

```bash
ollama list
```

**表示例：**
```
NAME              ID              SIZE      MODIFIED
gemma2:9b         ff02c3702f32    5.4 GB    2 weeks ago
llama3.1:8b       62757c860e01    4.7 GB    3 weeks ago
```

**モデルが表示されない場合：**
```
NAME    ID    SIZE    MODIFIED
```
→ LLM がダウンロードされていません。次のステップでダウンロードしてください。

---

### 1.4 LLM をダウンロード（モデルがない場合）

初めて使用する場合は、以下のコマンドで `gemma2:9b` をダウンロードしてください。

```bash
ollama pull gemma2:9b
```

**ダウンロード中の表示：**
```
pulling manifest
pulling ff02c3702f32... 100% ▕████████████████▏ 5.4 GB
pulling 109037bec39c... 100% ▕████████████████▏  136 B
...
success
```

> ⏱️ **所要時間**: 約5〜15分（インターネット速度によります）

> 💡 **他のモデルを使いたい場合**: <a href="https://ollama.com/library" target="_blank">Ollama Library</a> で利用可能なモデルを確認できます。

---

## 2. Docker Desktop のセットアップ

### 2.1 Docker がインストールされているか確認

```bash
docker --version
```

**成功した場合の表示例：**
```
Docker version 27.4.0, build bde2b89
```

**エラーの場合：**
```
command not found: docker
```
→ Docker Desktop がインストールされていません。<a href="https://www.docker.com/products/docker-desktop/" target="_blank">Docker公式サイト</a> からダウンロードしてインストールしてください。

> 📝 **インストール時の注意**: 「Apple Silicon」版を選択してください。

---

### 2.2 Docker Desktop が起動しているか確認

```bash
docker info
```

**成功した場合：** 多くの情報が表示されます（Server Version, Operating System など）

**エラーの場合：**
```
Cannot connect to the Docker daemon at unix:///Users/.../.docker/run/docker.sock. Is the docker daemon running?
```
→ Docker Desktop が起動していません。

**起動方法：**
1. Finder で「アプリケーション」フォルダを開く
2. 「Docker」をダブルクリック
3. メニューバーにクジラのアイコン 🐳 が表示されるまで待つ（約30秒〜1分）

---

## 3. llamune_chat の起動

### 3.1 docker-compose.yml をダウンロード

以下のURLにアクセスして、`docker-compose.yml` をダウンロードしてください。

https://raw.githubusercontent.com/unrcom/llamune_chat/main/docker-compose.yml

**ダウンロード方法：**
1. 上記URLをブラウザで開く
2. 右クリック →「名前を付けて保存」または `Cmd + S`
3. デスクトップなど、わかりやすい場所に保存

または、ターミナルで以下を実行：

```bash
cd ~/Desktop
curl -O https://raw.githubusercontent.com/unrcom/llamune_chat/main/docker-compose.yml
```

---

### 3.2 Docker コンテナを起動

`docker-compose.yml` を保存したフォルダで、以下のコマンドを実行してください。

```bash
cd ~/Desktop
docker compose up
```

**初回起動時の表示例：**
```
[+] Running 2/2
 ✔ Container llamune_chat_backend   Started
 ✔ Container llamune_chat_frontend  Started
Attaching to llamune_chat_backend, llamune_chat_frontend
llamune_chat_backend  | 🦙 Llamune_chat starting...
llamune_chat_backend  | 📦 Initializing database...
llamune_chat_backend  | ✅ Database initialized
llamune_chat_backend  | 🚀 API server running on http://localhost:3000
llamune_chat_frontend |   VITE v7.3.1  ready in 124 ms
llamune_chat_frontend |   ➜  Local:   http://localhost:5173/
```

> ⏱️ **初回起動時間**: 約1〜2分（Dockerイメージのダウンロードが必要なため）

---

### 3.3 ブラウザでアクセス

ブラウザを開いて以下のURLにアクセスしてください：

**http://localhost:5173**

ログイン画面が表示されます。

---

## 4. ユーザー登録とログイン

### 4.1 新規ユーザー登録

1. ログイン画面で「新規登録」をクリック
2. ユーザー名とパスワードを入力
3. 「登録」ボタンをクリック

登録が完了すると、自動的にログインされます。

---

## 5. 終了と再起動

### 5.1 llamune_chat を終了する

Docker コンテナを起動したターミナルで `Ctrl + C` を押してください。

```
^CGracefully stopping... (press Ctrl+C again to force)
[+] Stopping 2/2
 ✔ Container llamune_chat_frontend  Stopped
 ✔ Container llamune_chat_backend   Stopped
```

---

### 5.2 llamune_chat を再起動する

```bash
cd ~/Desktop
docker compose up
```

---

## 6. トラブルシューティング

### 「Ollama is not ready yet」や接続エラーが表示される

Ollama が起動していません。アプリケーションフォルダから Ollama を起動してください。

---

### 「port 5173 is already in use」と表示される

すでに別のアプリがポート5173を使用しています。以下のコマンドで確認・終了できます：

```bash
lsof -i :5173
kill -9 <PID>
```

---

### 「Cannot connect to the Docker daemon」と表示される

Docker Desktop が起動していません。アプリケーションフォルダから Docker を起動して、メニューバーにクジラのアイコン 🐳 が表示されるまで待ってください。

---

### 「container name is already in use」と表示される

以前のコンテナが残っています。以下のコマンドで削除してから再起動してください：

```bash
docker rm -f llamune_chat_backend llamune_chat_frontend
docker compose up
```

---

### データをリセットしたい

```bash
rm -rf ~/.llamune_chat
docker compose up
```

---

## 📞 サポート

問題が解決しない場合は、[GitHub Issues](https://github.com/unrcom/llamune_chat/issues) で報告してください。
