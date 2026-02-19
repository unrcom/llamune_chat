# Dockerイメージの更新手順

## 開発者向け：イメージの作成とpush

新機能を追加した後、Docker Hubにイメージを公開する手順です。

### 1. イメージをビルド

```bash
cd ~/dev/llamune_chat

docker build -t llamune_chat/backend:latest -f Dockerfile.backend .
docker build -t llamune_chat/frontend:latest ./web
```

### 2. Docker Hubにpush

```bash
docker push llamune_chat/backend:latest
docker push llamune_chat/frontend:latest
```

---

## エンドユーザー向け：最新版への更新

### 最新イメージを取得して起動

```bash
docker compose pull
docker compose up
```

または、1コマンドで：

```bash
docker compose up --pull always
```

---

## 参考：コマンド一覧

| コマンド | 説明 |
|---------|------|
| `docker build -t <イメージ名> .` | イメージをビルド |
| `docker push <イメージ名>` | Docker Hubにアップロード |
| `docker compose pull` | 最新イメージをダウンロード |
| `docker compose up` | コンテナを起動 |
| `docker compose up --pull always` | 最新イメージを取得して起動 |
| `docker compose down` | コンテナを停止・削除 |
