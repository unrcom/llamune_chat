# llamune Docker 起動ガイド

このガイドは、macOS（Appleシリコン）環境で llamune を Docker で起動するための詳細な手順です。

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
→ Ollama がインストールされていません。[Ollama公式サイト](https://ollama.com/) からダウンロードしてインストールしてください。

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
→ Ollama が起動していません。以下のコマンドで起動してください：

```bash
ollama serve
```

> 💡 **ヒント**: Ollama アプリをインストールしている場合は、アプリを起動するだけで自動的にサーバーが起動します（メニューバーにラマのアイコンが表示されます）。

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

> 💡 **他のモデルを使いたい場合**: [Ollama Library](https://ollama.com/library) で利用可能なモデルを確認できます。

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
→ Docker Desktop がインストールされていません。[Docker公式サイト](https://www.docker.com/products/docker-desktop/) からダウンロードしてインストールしてください。

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

## 3. llamune のダウンロードと起動

### 3.1 llamune をダウンロード

```bash
cd ~/Desktop
git clone https://github.com/unrcom/llamune.git
cd llamune
```

> 💡 この例ではデスクトップにダウンロードしていますが、お好みの場所で構いません。

---

### 3.2 Docker コンテナを起動

```bash
docker compose up --build
```

**初回起動時の表示例：**
```
[+] Building 45.2s (27/27) FINISHED
...
llamune_backend  | 🚀 Starting llamune backend setup...
llamune_backend  | 📝 Creating .env file from .env.example...
llamune_backend  | 🔑 Generating secrets...
llamune_backend  | ⏳ Waiting for Ollama to be ready...
llamune_backend  | ✅ Ollama is ready!
llamune_backend  | ✅ Admin user created (username: admin, password: admin)
llamune_backend  | 🎉 Setup complete! Starting API server...
llamune_frontend |   VITE v7.3.1  ready in 124 ms
llamune_frontend |   ➜  Local:   http://localhost:5173/
```

> ⏱️ **初回起動時間**: 約1〜5分（Dockerイメージのビルドが必要なため）

---

### 3.3 ブラウザでアクセス

ブラウザを開いて以下のURLにアクセスしてください：

**http://localhost:5173**

ログイン画面が表示されます。

---

## 4. ログインとユーザー作成

### 4.1 管理者でログイン

初期設定では管理者ユーザーが自動作成されています。

- **ユーザー名**: `admin`
- **パスワード**: `admin`

---

### 4.2 新しいユーザーを作成（オプション）

管理者以外のユーザーを作成したい場合は、**別のターミナルウィンドウ**を開いて以下のコマンドを実行してください。

```bash
cd ~/Desktop/llamune
docker exec -it llamune_backend npm run dev:cli -- create-user <ユーザー名> <パスワード> user
```

**例：ユーザー「taro」をパスワード「mypassword」で作成**
```bash
docker exec -it llamune_backend npm run dev:cli -- create-user taro mypassword user
```

**成功した場合の表示：**
```
User created: taro (role: user)
```

> 📝 **ロールの種類**:
> - `admin`: 管理者（すべての機能にアクセス可能）
> - `user`: 一般ユーザー

---

## 5. 終了と再起動

### 5.1 llamune を終了する

Docker コンテナを起動したターミナルで `Ctrl + C` を押してください。

```
^CGracefully stopping... (press Ctrl+C again to force)
[+] Stopping 2/2
 ✔ Container llamune_frontend  Stopped
 ✔ Container llamune_backend   Stopped
```

---

### 5.2 llamune を再起動する

```bash
cd ~/Desktop/llamune
docker compose up
```

> 💡 2回目以降は `--build` オプションは不要です（ソースコードを変更した場合のみ必要）。

---

## 6. トラブルシューティング

### 「Ollama is not ready yet」と表示され続ける

Ollama が起動していません。別のターミナルで以下を実行してください：

```bash
ollama serve
```

または、Ollama アプリを起動してください。

---

### 「port 5173 is already in use」と表示される

すでに別のアプリがポート5173を使用しています。以下のコマンドで確認・終了できます：

```bash
lsof -i :5173
kill -9 <PID>
```

---

### 「Cannot connect to the Docker daemon」と表示される

Docker Desktop が起動していません。アプリケーションから Docker を起動してください。

---

### コンテナを完全にリセットしたい

```bash
docker compose down
docker rm -f llamune_backend llamune_frontend
docker compose up --build
```

---

## 📞 サポート

問題が解決しない場合は、[GitHub Issues](https://github.com/unrcom/llamune/issues) で報告してください。
