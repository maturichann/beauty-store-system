# I am Beauty Store 注文システム

完全な注文管理システム - メール送信、Google Sheets連携、Stripe決済を統合

## 🚀 機能

- ✅ **注文フォーム**: 美しいレスポンシブデザイン
- ✅ **メール送信**: 注文確認メールの自動送信（Resend API）
- ✅ **Google Sheets連携**: 注文データの自動記録
- ✅ **Stripe決済**: クレジットカード決済の統合
- ✅ **バリデーション**: フォーム入力の検証
- ✅ **リアルタイム計算**: 価格の自動計算

## 📁 プロジェクト構成

```
beauty-store-system/
├── server.js              # メインサーバーファイル
├── package.json           # 依存関係とスクリプト
├── .env.example          # 環境変数のサンプル
├── README.md             # このファイル
└── public/
    ├── index.html        # メインの注文フォーム
    ├── success.html      # 決済成功ページ
    └── cancel.html       # 決済キャンセルページ
```

## 🛠 セットアップ手順

### 1. 依存関係のインストール

```bash
cd beauty-store-system
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成：

```bash
cp .env.example .env
```

### 3. 各サービスの設定

#### 🔐 Stripe（クレジットカード決済）

1. [Stripe Dashboard](https://dashboard.stripe.com/)にログイン
2. **API キー**から`秘密キー`をコピー
3. **Webhook**を設定:
   - エンドポイント: `https://yourdomain.com/webhook/stripe`
   - イベント: `checkout.session.completed`
4. `.env`ファイルに設定:

```env
STRIPE_SECRET_KEY=sk_test_51xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...
```

#### 📧 Resend（メール送信）

1. [Resend](https://resend.com/)でアカウント作成
2. **API Keys**でAPIキーを生成
3. **Domains**でドメインを認証
4. `.env`ファイルに設定:

```env
RESEND_API_KEY=re_xxx...
FROM_EMAIL=orders@yourdomain.com
```

#### 📊 Google Sheets（注文記録）

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
2. **Google Sheets API**を有効化
3. **サービスアカウント**を作成してJSONキーをダウンロード
4. Google Sheetsファイルを作成し、サービスアカウントに編集権限を付与
5. スプレッドシートのヘッダー行を設定:

```
注文日時 | 注文番号 | 注文種別 | 氏名 | フリガナ | サロン名 | メール | 電話 | 住所 | 配達時間 | MEGAMI数量 | リーフレット数量 | 商品合計 | 送料 | 手数料 | 合計 | 支払方法 | 決済状況
```

6. `.env`ファイルに設定:

```env
GOOGLE_SHEETS_ID=スプレッドシートID
GOOGLE_SHEETS_CLIENT_EMAIL=サービスアカウントのメールアドレス
GOOGLE_SHEETS_CLIENT_ID=クライアントID
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n秘密鍵\n-----END PRIVATE KEY-----\n"
```

### 4. サーバー起動

```bash
# 開発環境
npm run dev

# 本番環境
npm start
```

サーバーは `http://localhost:3000` で起動します。

## 🌐 デプロイ

### Heroku

1. Herokuアプリを作成:
```bash
heroku create your-app-name
```

2. 環境変数を設定:
```bash
heroku config:set STRIPE_SECRET_KEY=sk_test_xxx...
heroku config:set RESEND_API_KEY=re_xxx...
heroku config:set GOOGLE_SHEETS_ID=xxx...
# 他の環境変数も同様に設定
```

3. デプロイ:
```bash
git push heroku main
```

### Vercel

1. プロジェクトをGitHubにプッシュ
2. [Vercel](https://vercel.com/)でプロジェクトをインポート
3. 環境変数を設定
4. デプロイ

### Railway

1. [Railway](https://railway.app/)でプロジェクトを作成
2. GitHubリポジトリを接続
3. 環境変数を設定
4. 自動デプロイ

## 🔍 動作確認

### ヘルスチェック

システムの状態を確認:
```
GET /api/health
```

レスポンス例:
```json
{
  "status": "OK",
  "services": {
    "stripe": true,
    "resend": true,
    "sheets": true
  }
}
```

### テスト注文

1. ブラウザで `http://localhost:3000` にアクセス
2. フォームに必要事項を入力
3. 注文を送信
4. 以下を確認:
   - 確認メールの受信
   - Google Sheetsへのデータ記録
   - Stripe決済（テストモード）

## 🛡 セキュリティ

- 本番環境では必ずHTTPS接続を使用
- 環境変数は絶対にコミットしない
- Stripe WebhookのシークレットでWebhookを検証
- APIキーは定期的にローテーション

## 📞 サポート

問題が発生した場合：

1. **ログを確認**: サーバーコンソールでエラーメッセージを確認
2. **ヘルスチェック**: `/api/health`でサービス状態を確認
3. **環境変数**: すべての必要な環境変数が設定されているか確認

## 🔧 カスタマイズ

### 商品情報の変更

`server.js`の`products`オブジェクトを編集:

```javascript
const products = {
    megami: {
        price: 3894,  // 価格（円）
        name: 'I am MEGAMI フェイシャルパック',
        code: 'MGM-001'
    },
    // ...
};
```

### メールテンプレートの変更

`sendOrderEmail`関数の`emailHtml`変数を編集してカスタマイズ可能。

### デザインの変更

`public/index.html`のCSSセクションを編集してUIをカスタマイズ可能。

## 📊 注文データ形式

Google Sheetsに記録される注文データ:

| フィールド | 説明 |
|-----------|------|
| 注文日時 | 注文が作成された日時 |
| 注文番号 | 一意の注文識別子 |
| 注文種別 | 初回発注 / 2回目以降 |
| 氏名 | 顧客の氏名 |
| フリガナ | 顧客の氏名（カナ） |
| サロン名 | サロン/法人名 |
| メール | 顧客のメールアドレス |
| 電話 | 顧客の電話番号 |
| 住所 | 配送先住所（結合済み） |
| 配達時間 | 希望配達時間帯 |
| MEGAMI数量 | MEGAMIパックの注文数 |
| リーフレット数量 | リーフレットの注文数 |
| 商品合計 | 商品代金の合計 |
| 送料 | 配送料 |
| 手数料 | 代引き手数料等 |
| 合計 | 総合計金額 |
| 支払方法 | credit_card / cod |
| 決済状況 | pending / completed |

これで誰でも使える完全な注文システムが完成しました！