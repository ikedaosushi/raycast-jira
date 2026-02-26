# Assignee & Sprint フィールド追加 実装プラン

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** チケット作成フォームの Step 1・Step 2 に Assignee と Sprint のドロップダウンを追加する

**Architecture:** 既存の `api.ts` に JIRA Agile REST API（ボード・スプリント取得）を追加し、`create-ticket.tsx` の両ステップに Assignee/Sprint ドロップダウンを追加。プロジェクト選択時に依存データを自動読み込みする。

**Tech Stack:** TypeScript, React, @raycast/api, JIRA REST API v3 + Agile REST API

---

### Task 1: API に型定義とボード・スプリント取得関数を追加

**Files:**
- Modify: `src/api.ts:28-39` (型定義の後に追加)
- Modify: `src/api.ts:224` (関数末尾に追加)

**Step 1: JiraBoard と JiraSprint の型定義を追加**

`src/api.ts` の `JiraIssueType` インターフェースの後（39行目以降）に追加:

```typescript
export interface JiraBoard {
  id: number;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}
```

**Step 2: `getBoardsForProject()` 関数を追加**

`src/api.ts` の `assignIssue()` 関数の後に追加:

```typescript
export async function getBoardsForProject(
  projectKey: string,
): Promise<JiraBoard[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=50`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { values: JiraBoard[] };
  return data.values;
}
```

**Step 3: `getSprintsForBoard()` 関数を追加**

`getBoardsForProject()` の後に追加:

```typescript
export async function getSprintsForBoard(
  boardId: number,
): Promise<JiraSprint[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active,future&maxResults=50`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { values: JiraSprint[] };
  return data.values;
}
```

**Step 4: lint 確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: no errors

**Step 5: Commit**

```bash
git add src/api.ts
git commit -m "feat: add board and sprint API functions"
```

---

### Task 2: `createIssue()` に assignee と sprint パラメータを追加

**Files:**
- Modify: `src/api.ts:153-196` (`createIssue` 関数)

**Step 1: `createIssue()` のシグネチャと body にフィールド追加**

`createIssue()` 関数を以下のように変更:

```typescript
export async function createIssue(
  projectKey: string,
  issueTypeId: string,
  summary: string,
  description?: string,
  assigneeAccountId?: string,
  sprintId?: number,
): Promise<{ key: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue`;

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: { id: issueTypeId },
    summary,
    ...(description
      ? {
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          },
        }
      : {}),
    ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
    ...(sprintId ? { sprint: { id: sprintId } } : {}),
  };

  const body: Record<string, unknown> = { fields };

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jira API error: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as { key: string };
}
```

**Step 2: lint 確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: no errors

**Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: add assignee and sprint params to createIssue"
```

---

### Task 3: Step 1（入力フォーム）に Assignee・Sprint ドロップダウンを追加

**Files:**
- Modify: `src/create-ticket.tsx:1-21` (import追加)
- Modify: `src/create-ticket.tsx:151-272` (`CreateTicket` コンポーネント)

**Step 1: import に新しい API 関数を追加**

`src/create-ticket.tsx` の import 文を更新:

```typescript
import {
  createIssue,
  getAssignableUsers,
  getBoardsForProject,
  getIssueTypesForProject,
  getIssueUrl,
  getProjects,
  getSprintsForBoard,
} from "./api";
```

**Step 2: `CreateTicket` コンポーネントに assignee/sprint のデータ取得を追加**

`useCachedPromise(getIssueTypesForProject, ...)` の後に追加:

```typescript
const { data: assignableUsers, isLoading: isLoadingUsers } = useCachedPromise(
  getAssignableUsers,
  [projectKey],
  { execute: !!projectKey },
);

const { data: boards } = useCachedPromise(
  getBoardsForProject,
  [projectKey],
  { execute: !!projectKey },
);

const [sprints, setSprints] = useState<{ id: number; name: string; state: string }[]>([]);
const [isLoadingSprints, setIsLoadingSprints] = useState(false);

useEffect(() => {
  if (!boards || boards.length === 0) {
    setSprints([]);
    return;
  }
  setIsLoadingSprints(true);
  Promise.all(boards.map((board) => getSprintsForBoard(board.id)))
    .then((results) => setSprints(results.flat()))
    .catch(() => setSprints([]))
    .finally(() => setIsLoadingSprints(false));
}, [boards]);
```

**Step 3: `handleSubmit` の values 型と push に assignee/sprint を追加**

```typescript
async function handleSubmit(values: {
  project: string;
  issueType: string;
  roughInput: string;
  assignee: string;
  sprint: string;
}) {
  // ... 既存のバリデーションとAI生成 ...

  push(
    <ConfirmTicketForm
      projectKey={values.project}
      issueTypeId={values.issueType}
      initialSummary={generated.summary}
      initialDescription={generated.description}
      initialAssignee={values.assignee}
      initialSprint={values.sprint}
    />,
  );
}
```

**Step 4: Form JSX に Assignee・Sprint ドロップダウンを追加**

`<Form.TextArea id="roughInput" ...>` の前に追加:

```tsx
<Form.Dropdown id="assignee" title="Assignee" defaultValue="">
  <Form.Dropdown.Item key="unassigned" value="" title="Unassigned" />
  {(assignableUsers ?? []).map((user) => (
    <Form.Dropdown.Item
      key={user.accountId}
      value={user.accountId}
      title={user.displayName}
      icon={user.avatarUrls["48x48"]}
    />
  ))}
</Form.Dropdown>

<Form.Dropdown id="sprint" title="Sprint" defaultValue="">
  <Form.Dropdown.Item key="none" value="" title="None" />
  {sprints.map((sprint) => (
    <Form.Dropdown.Item
      key={String(sprint.id)}
      value={String(sprint.id)}
      title={`${sprint.name} (${sprint.state})`}
    />
  ))}
</Form.Dropdown>
```

**Step 5: isLoading に新しいローディング状態を追加**

```tsx
<Form
  isLoading={isLoadingProjects || isLoadingTypes || isLoadingUsers || isLoadingSprints}
```

**Step 6: lint 確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: no errors

**Step 7: Commit**

```bash
git add src/create-ticket.tsx
git commit -m "feat: add assignee and sprint dropdowns to Step 1 form"
```

---

### Task 4: Step 2（確認フォーム）に Assignee・Sprint ドロップダウンを追加

**Files:**
- Modify: `src/create-ticket.tsx:41-148` (`ConfirmTicketForm` コンポーネント)

**Step 1: `ConfirmTicketForm` の props に assignee/sprint を追加**

```typescript
function ConfirmTicketForm(props: {
  projectKey: string;
  issueTypeId: string;
  initialSummary: string;
  initialDescription: string;
  initialAssignee: string;
  initialSprint: string;
}) {
```

**Step 2: assignee/sprint のデータ取得を追加**

既存の `useCachedPromise(getIssueTypesForProject, ...)` の後に追加:

```typescript
const { data: assignableUsers, isLoading: isLoadingUsers } = useCachedPromise(
  getAssignableUsers,
  [projectKey],
  { execute: !!projectKey },
);

const { data: boards } = useCachedPromise(
  getBoardsForProject,
  [projectKey],
  { execute: !!projectKey },
);

const [sprints, setSprints] = useState<{ id: number; name: string; state: string }[]>([]);
const [isLoadingSprints, setIsLoadingSprints] = useState(false);

useEffect(() => {
  if (!boards || boards.length === 0) {
    setSprints([]);
    return;
  }
  setIsLoadingSprints(true);
  Promise.all(boards.map((board) => getSprintsForBoard(board.id)))
    .then((results) => setSprints(results.flat()))
    .catch(() => setSprints([]))
    .finally(() => setIsLoadingSprints(false));
}, [boards]);
```

**Step 3: `handleSubmit` に assignee/sprint を追加**

```typescript
async function handleSubmit(values: {
  project: string;
  issueType: string;
  summary: string;
  description: string;
  assignee: string;
  sprint: string;
}) {
  // ...
  const result = await createIssue(
    values.project,
    values.issueType,
    values.summary,
    values.description || undefined,
    values.assignee || undefined,
    values.sprint ? Number(values.sprint) : undefined,
  );
  // ...
}
```

**Step 4: Form JSX に Assignee・Sprint ドロップダウンを追加**

`<Form.TextArea id="description" ...>` の後に追加:

```tsx
<Form.Dropdown
  id="assignee"
  title="Assignee"
  defaultValue={props.initialAssignee}
>
  <Form.Dropdown.Item key="unassigned" value="" title="Unassigned" />
  {(assignableUsers ?? []).map((user) => (
    <Form.Dropdown.Item
      key={user.accountId}
      value={user.accountId}
      title={user.displayName}
      icon={user.avatarUrls["48x48"]}
    />
  ))}
</Form.Dropdown>

<Form.Dropdown
  id="sprint"
  title="Sprint"
  defaultValue={props.initialSprint}
>
  <Form.Dropdown.Item key="none" value="" title="None" />
  {sprints.map((sprint) => (
    <Form.Dropdown.Item
      key={String(sprint.id)}
      value={String(sprint.id)}
      title={`${sprint.name} (${sprint.state})`}
    />
  ))}
</Form.Dropdown>
```

**Step 5: isLoading に新しいローディング状態を追加**

```tsx
<Form
  isLoading={isLoadingProjects || isLoadingTypes || isLoadingUsers || isLoadingSprints}
```

**Step 6: lint 確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: no errors

**Step 7: Commit**

```bash
git add src/create-ticket.tsx
git commit -m "feat: add assignee and sprint dropdowns to Step 2 form"
```

---

### Task 5: ビルド確認と最終検証

**Files:**
- All modified files

**Step 1: TypeScript ビルド確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run build`
Expected: Build succeeds

**Step 2: lint 最終確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: no errors

**Step 3: 問題があれば修正して Commit**

```bash
git add -A
git commit -m "fix: address build/lint issues"
```
