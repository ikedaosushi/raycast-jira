# AI-Assisted Ticket Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** create-ticketコマンドにOpenAI連携を追加し、ざっくり入力からsummary/descriptionを自動生成する2ステップフォームにする。

**Architecture:** Step 1でProject/IssueType/ざっくり入力を受け取り、OpenAI APIでsummary/descriptionを生成。Step 2でAI生成結果をpre-fillしたフォームで確認・編集後、Jiraチケットを作成する。OpenAI呼び出しは`src/openai.ts`に分離。

**Tech Stack:** TypeScript, React, @raycast/api, openai npm package, gpt-4o-mini

---

### Task 1: openai パッケージのインストールとPreferences追加

**Files:**
- Modify: `package.json:24-46` (preferences配列にopenaiApiKeyを追加)

**Step 1: openaiパッケージをインストール**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm install openai`

**Step 2: package.jsonにopenaiApiKey preferenceを追加**

`package.json`のpreferences配列の末尾に追加:

```json
{
  "name": "openaiApiKey",
  "title": "OpenAI API Key",
  "description": "OpenAI API key for AI-assisted ticket creation",
  "type": "password",
  "required": true
}
```

**Step 3: ビルド確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run build`
Expected: ビルド成功

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add openai dependency and API key preference"
```

---

### Task 2: OpenAI API呼び出しモジュール作成

**Files:**
- Create: `src/openai.ts`

**Step 1: src/openai.tsを作成**

```typescript
import { getPreferenceValues } from "@raycast/api";
import OpenAI from "openai";

interface Preferences {
  openaiApiKey: string;
}

interface GeneratedTicket {
  summary: string;
  description: string;
}

export async function generateTicketContent(roughInput: string): Promise<GeneratedTicket> {
  const { openaiApiKey } = getPreferenceValues<Preferences>();
  const client = new OpenAI({ apiKey: openaiApiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that creates Jira ticket content from rough user input.
Given the user's rough description, generate:
- summary: A concise one-line title for the Jira ticket (max 100 chars)
- description: A clear, structured description suitable for a Jira ticket

Respond in the same language as the input.
Respond ONLY with valid JSON in this format: {"summary": "...", "description": "..."}`,
      },
      {
        role: "user",
        content: roughInput,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content) as GeneratedTicket;
  if (!parsed.summary || !parsed.description) {
    throw new Error("OpenAI response missing summary or description");
  }

  return parsed;
}
```

**Step 2: ビルド確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run build`
Expected: ビルド成功

**Step 3: Commit**

```bash
git add src/openai.ts
git commit -m "feat: add OpenAI module for ticket content generation"
```

---

### Task 3: create-ticket.tsxを2ステップフォームに改修

**Files:**
- Modify: `src/create-ticket.tsx` (全体を改修)

**Step 1: create-ticket.tsxを2ステップフォームに書き換え**

`src/create-ticket.tsx`を以下の構成に改修:

```typescript
import { Action, ActionPanel, Form, LocalStorage, showToast, Toast, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useState } from "react";
import { createIssue, getIssueTypesForProject, getIssueUrl, getProjects } from "./api";
import { generateTicketContent } from "./openai";

const RECENT_PROJECT_KEY = "recentProjectKey";
const RECENT_ISSUE_TYPE_ID = "recentIssueTypeId";

function sortByRecent<T>(items: T[], getKey: (item: T) => string, recentKey: string | undefined): T[] {
  if (!recentKey) return items;
  return [...items].sort((a, b) => {
    const aIsRecent = getKey(a) === recentKey;
    const bIsRecent = getKey(b) === recentKey;
    if (aIsRecent && !bIsRecent) return -1;
    if (!aIsRecent && bIsRecent) return 1;
    return 0;
  });
}

// Step 2: AI生成結果の確認・編集 → Jiraチケット作成
function ConfirmTicketForm(props: {
  projectKey: string;
  issueTypeId: string;
  initialSummary: string;
  initialDescription: string;
}) {
  const { pop } = useNavigation();
  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(getProjects, []);
  const [projectKey, setProjectKey] = useState(props.projectKey);
  const { data: issueTypes, isLoading: isLoadingTypes } = useCachedPromise(
    getIssueTypesForProject,
    [projectKey],
    { execute: !!projectKey },
  );

  async function handleSubmit(values: { project: string; issueType: string; summary: string; description: string }) {
    if (!values.summary.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Summary is required" });
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating ticket..." });

    try {
      const result = await createIssue(values.project, values.issueType, values.summary, values.description || undefined);
      await LocalStorage.setItem(RECENT_PROJECT_KEY, values.project);
      await LocalStorage.setItem(RECENT_ISSUE_TYPE_ID, values.issueType);
      toast.style = Toast.Style.Success;
      toast.title = `Created ${result.key}`;
      toast.primaryAction = {
        title: "Open in Jira",
        onAction: () => {
          const url = getIssueUrl(result.key);
          import("@raycast/api").then(({ open }) => open(url));
        },
      };
      pop();
      pop();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create ticket";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Form
      isLoading={isLoadingProjects || isLoadingTypes}
      navigationTitle="Confirm & Create Ticket"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Ticket" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="project"
        title="Project"
        value={projectKey}
        onChange={(value) => setProjectKey(value)}
      >
        {(projects ?? []).map((project) => (
          <Form.Dropdown.Item key={project.key} value={project.key} title={`${project.name} (${project.key})`} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="issueType" title="Issue Type" defaultValue={props.issueTypeId}>
        {(issueTypes ?? []).map((type) => (
          <Form.Dropdown.Item key={type.id} value={type.id} title={type.name} />
        ))}
      </Form.Dropdown>

      <Form.TextField id="summary" title="Summary" defaultValue={props.initialSummary} />

      <Form.TextArea id="description" title="Description" defaultValue={props.initialDescription} />
    </Form>
  );
}

// Step 1: Project/IssueType選択 + ざっくり入力 → AI生成
export default function CreateTicket() {
  const { push } = useNavigation();
  const [projectKey, setProjectKey] = useState("");
  const [recentProjectKey, setRecentProjectKey] = useState<string>();
  const [recentIssueTypeId, setRecentIssueTypeId] = useState<string>();

  useEffect(() => {
    (async () => {
      const savedProject = await LocalStorage.getItem<string>(RECENT_PROJECT_KEY);
      const savedIssueType = await LocalStorage.getItem<string>(RECENT_ISSUE_TYPE_ID);
      if (savedProject) {
        setRecentProjectKey(savedProject);
        setProjectKey(savedProject);
      }
      if (savedIssueType) setRecentIssueTypeId(savedIssueType);
    })();
  }, []);

  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(getProjects, []);

  const { data: issueTypes, isLoading: isLoadingTypes } = useCachedPromise(getIssueTypesForProject, [projectKey], {
    execute: !!projectKey,
  });

  async function handleSubmit(values: { project: string; issueType: string; roughInput: string }) {
    if (!values.roughInput.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Input is required" });
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: "Generating with AI..." });

    try {
      const generated = await generateTicketContent(values.roughInput);
      toast.style = Toast.Style.Success;
      toast.title = "Generated!";

      push(
        <ConfirmTicketForm
          projectKey={values.project}
          issueTypeId={values.issueType}
          initialSummary={generated.summary}
          initialDescription={generated.description}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "AI generation failed";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Form
      isLoading={isLoadingProjects || isLoadingTypes}
      navigationTitle="Create Ticket with AI"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Generate with AI" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="project"
        title="Project"
        value={projectKey || undefined}
        onChange={(value) => setProjectKey(value)}
      >
        {sortByRecent(projects ?? [], (p) => p.key, recentProjectKey).map((project) => (
          <Form.Dropdown.Item key={project.key} value={project.key} title={`${project.name} (${project.key})`} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="issueType" title="Issue Type" defaultValue={recentIssueTypeId}>
        {sortByRecent(issueTypes ?? [], (t) => t.id, recentIssueTypeId).map((type) => (
          <Form.Dropdown.Item key={type.id} value={type.id} title={type.name} />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="roughInput"
        title="What do you want to do?"
        placeholder="ざっくり内容を入力してください（例：ログイン画面にパスワードリセット機能を追加したい）"
      />
    </Form>
  );
}
```

**Step 2: ビルド確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run build`
Expected: ビルド成功

**Step 3: 手動テスト**

1. Raycastで`Create Ticket`コマンドを実行
2. Project、Issue Typeを選択し、ざっくり入力に「ログインページにダークモードを追加したい」と入力
3. Submit → AI生成のローディングトーストが表示される
4. 生成完了後、Step 2の確認画面に遷移し、summaryとdescriptionがpre-fillされている
5. 内容を確認・編集し、Submit → Jiraチケットが作成される

**Step 4: Commit**

```bash
git add src/create-ticket.tsx
git commit -m "feat: convert create-ticket to 2-step AI-assisted form"
```

---

### Task 4: lint確認と最終テスト

**Step 1: lint実行**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run lint`
Expected: エラーなし

**Step 2: lint修正（必要な場合）**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run fix-lint`

**Step 3: 最終ビルド確認**

Run: `cd /Users/yutaro/ghq/ikedaosushi-github.com/ikedaosushi/raycast-jira && npm run build`
Expected: ビルド成功
