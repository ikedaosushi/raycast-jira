# AI-Assisted Ticket Creation Design

## Overview

create-ticketコマンドにOpenAI連携を追加し、ユーザーのざっくりした自由テキスト入力からsummaryとdescriptionを自動生成する。

## User Flow

### Step 1: ざっくり入力画面
- Project選択 (ドロップダウン)
- Issue Type選択 (ドロップダウン)
- ざっくり内容 (テキストエリア)
- Submit → OpenAI API呼び出し → Step 2へ遷移

### Step 2: 確認・編集画面
- Project (pre-fill、変更可)
- Issue Type (pre-fill、変更可)
- Summary (AI生成結果、編集可)
- Description (AI生成結果、編集可)
- Submit → Jira APIでチケット作成 → ブラウザで開く

## Technical Design

### OpenAI連携
- **パッケージ**: `openai` npm package
- **モデル**: `gpt-4o-mini`
- **API Key**: Raycast Preferences (`openaiApiKey`, password型)
- **レスポンス形式**: `{ "summary": "...", "description": "..." }` (JSON)

### ファイル構成
- `src/api.ts` — 変更なし
- `src/create-ticket.tsx` — 2ステップフォームに改修
- `src/openai.ts` — 新規。OpenAI API呼び出しロジック

### Preferences追加 (package.json)
```json
{
  "name": "openaiApiKey",
  "title": "OpenAI API Key",
  "type": "password",
  "required": true,
  "description": "OpenAI API key for AI-assisted ticket creation"
}
```

### OpenAI プロンプト設計
- 入力: ユーザーのざっくりテキスト
- 出力: JSON `{ "summary": "...", "description": "..." }`
- summaryは簡潔な1行、descriptionは詳細な説明
- 日本語入力には日本語で返す

## Approach
- **2ステップ画面方式**: 入力画面とAI生成結果の確認画面を分離
- AI生成中はローディングトーストを表示
- 生成結果はユーザーが自由に編集可能
