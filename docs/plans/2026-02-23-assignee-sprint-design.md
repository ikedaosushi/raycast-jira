# Create Ticket: Assignee & Sprint フィールド追加

## 概要

チケット作成フォーム（Step 1 / Step 2）に Assignee と Sprint のドロップダウンフィールドを追加する。

## API追加

### `getBoardsForProject(projectKey: string)`
- エンドポイント: `GET /rest/agile/1.0/board?projectKeyOrId={projectKey}`
- プロジェクトに紐づくボード一覧を取得
- 返り値: `{ id, name }[]`

### `getSprintsForBoard(boardId: number)`
- エンドポイント: `GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future`
- ボードのactive/futureスプリントを取得
- 返り値: `{ id, name, state }[]`

### `createIssue()` 拡張
- `assigneeAccountId?: string` パラメータ追加 → `fields.assignee.accountId`
- `sprintId?: number` パラメータ追加 → `fields.sprint.id` (customfield の場合あり)

## フォーム変更

### Step 1（入力フォーム）
- Project、Issue Type の下に Assignee ドロップダウン追加
- Sprint ドロップダウン追加
- どちらもオプショナル（未選択可）

### Step 2（確認フォーム）
- Summary、Description の下に Assignee、Sprint ドロップダウン追加
- Step 1 の値を初期値として引き継ぎ

## データフロー

```
Project選択
├── getAssignableUsers(projectKey) → Assignee リスト
└── getBoardsForProject(projectKey) → boardId[]
    └── getSprintsForBoard(boardId) → Sprint リスト
```

ボードが複数ある場合は、全ボードのスプリントをまとめて表示する。

## 注意事項

- Sprint フィールドは JIRA の設定によって `customfield_XXXXX` の場合がある
- Agile REST API は `/rest/agile/1.0/` を使用（通常の REST API v3 とは異なるベースURL）
