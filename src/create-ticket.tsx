import {
  Action,
  ActionPanel,
  Form,
  LocalStorage,
  open,
  popToRoot,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useState } from "react";
import {
  createIssue,
  getAssignableUsers,
  getBoardsForProject,
  getCurrentUser,
  getIssueTypesForProject,
  getIssueUrl,
  getProjects,
  getSprintsForBoard,
} from "./api";
import { generateTicketContent } from "./openai";

const RECENT_PROJECT_KEY = "recentProjectKey";
const RECENT_ISSUE_TYPE_ID = "recentIssueTypeId";
const RECENT_ASSIGNEE_ID = "recentAssigneeId";

function sortByRecent<T>(
  items: T[],
  getKey: (item: T) => string,
  recentKey: string | undefined,
): T[] {
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
  initialAssignee: string;
  initialSprint: string;
}) {
  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(
    getProjects,
    [],
  );
  const [projectKey, setProjectKey] = useState(props.projectKey);
  const { data: issueTypes, isLoading: isLoadingTypes } = useCachedPromise(
    getIssueTypesForProject,
    [projectKey],
    { execute: !!projectKey },
  );

  const { data: assignableUsers, isLoading: isLoadingUsers } = useCachedPromise(
    getAssignableUsers,
    [projectKey],
    { execute: !!projectKey },
  );

  const { data: boards } = useCachedPromise(getBoardsForProject, [projectKey], {
    execute: !!projectKey,
  });

  const [sprints, setSprints] = useState<
    { id: number; name: string; state: string }[]
  >([]);
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

  const activeSprint = sprints.find((s) => s.state === "active");
  const defaultSprint =
    props.initialSprint || (activeSprint ? String(activeSprint.id) : "");

  async function handleSubmit(values: {
    project: string;
    issueType: string;
    summary: string;
    description: string;
    assignee: string;
    sprint: string;
  }) {
    if (!values.summary.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Summary is required",
      });
      return;
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Creating ticket...",
    });

    try {
      const result = await createIssue(
        values.project,
        values.issueType,
        values.summary,
        values.description || undefined,
        values.assignee || undefined,
        values.sprint ? Number(values.sprint) : undefined,
      );
      await LocalStorage.setItem(RECENT_PROJECT_KEY, values.project);
      await LocalStorage.setItem(RECENT_ISSUE_TYPE_ID, values.issueType);
      if (values.assignee) {
        await LocalStorage.setItem(RECENT_ASSIGNEE_ID, values.assignee);
      }
      toast.style = Toast.Style.Success;
      toast.title = `Created ${result.key}`;
      toast.primaryAction = {
        title: "Open in Jira",
        onAction: () => open(getIssueUrl(result.key)),
      };
      await popToRoot();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create ticket";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Form
      isLoading={
        isLoadingProjects ||
        isLoadingTypes ||
        isLoadingUsers ||
        isLoadingSprints
      }
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
          <Form.Dropdown.Item
            key={project.key}
            value={project.key}
            title={`${project.name} (${project.key})`}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="issueType"
        title="Issue Type"
        defaultValue={props.issueTypeId}
      >
        {(issueTypes ?? []).map((type) => (
          <Form.Dropdown.Item key={type.id} value={type.id} title={type.name} />
        ))}
      </Form.Dropdown>

      <Form.TextField
        id="summary"
        title="Summary"
        defaultValue={props.initialSummary}
      />

      <Form.TextArea
        id="description"
        title="Description"
        defaultValue={props.initialDescription}
      />

      <Form.Dropdown
        id="assignee"
        title="Assignee"
        defaultValue={props.initialAssignee}
      >
        <Form.Dropdown.Item key="unassigned" value="" title="Unassigned" />
        {sortByRecent(
          assignableUsers ?? [],
          (u) => u.accountId,
          props.initialAssignee,
        ).map((user) => (
          <Form.Dropdown.Item
            key={user.accountId}
            value={user.accountId}
            title={user.displayName}
            icon={user.avatarUrls["48x48"]}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="sprint" title="Sprint" defaultValue={defaultSprint}>
        <Form.Dropdown.Item key="none" value="" title="None" />
        {sprints.map((sprint) => (
          <Form.Dropdown.Item
            key={String(sprint.id)}
            value={String(sprint.id)}
            title={`${sprint.name} (${sprint.state})`}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

// Step 1: Project/IssueType選択 + ざっくり入力 → AI生成
export default function CreateTicket() {
  const { push } = useNavigation();
  const [projectKey, setProjectKey] = useState("");
  const [recentProjectKey, setRecentProjectKey] = useState<string>();
  const [recentIssueTypeId, setRecentIssueTypeId] = useState<string>();
  const [recentAssigneeId, setRecentAssigneeId] = useState<string>();
  const [currentUserId, setCurrentUserId] = useState<string>();

  useEffect(() => {
    (async () => {
      const savedProject =
        await LocalStorage.getItem<string>(RECENT_PROJECT_KEY);
      const savedIssueType =
        await LocalStorage.getItem<string>(RECENT_ISSUE_TYPE_ID);
      const savedAssignee =
        await LocalStorage.getItem<string>(RECENT_ASSIGNEE_ID);
      if (savedProject) {
        setRecentProjectKey(savedProject);
        setProjectKey(savedProject);
      }
      if (savedIssueType) setRecentIssueTypeId(savedIssueType);
      if (savedAssignee) setRecentAssigneeId(savedAssignee);
      try {
        const me = await getCurrentUser();
        setCurrentUserId(me.accountId);
      } catch {
        // ignore - will default to unassigned
      }
    })();
  }, []);

  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(
    getProjects,
    [],
  );

  const { data: issueTypes, isLoading: isLoadingTypes } = useCachedPromise(
    getIssueTypesForProject,
    [projectKey],
    {
      execute: !!projectKey,
    },
  );

  const { data: assignableUsers, isLoading: isLoadingUsers } = useCachedPromise(
    getAssignableUsers,
    [projectKey],
    { execute: !!projectKey },
  );

  const { data: boards } = useCachedPromise(getBoardsForProject, [projectKey], {
    execute: !!projectKey,
  });

  const [sprints, setSprints] = useState<
    { id: number; name: string; state: string }[]
  >([]);
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

  const defaultAssignee = recentAssigneeId ?? currentUserId ?? "";
  const activeSprint = sprints.find((s) => s.state === "active");
  const defaultSprint = activeSprint ? String(activeSprint.id) : "";

  async function handleSubmit(values: {
    project: string;
    issueType: string;
    roughInput: string;
    assignee: string;
    sprint: string;
  }) {
    if (!values.roughInput.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Input is required",
      });
      return;
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Generating with AI...",
    });

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
          initialAssignee={values.assignee}
          initialSprint={values.sprint}
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
      isLoading={
        isLoadingProjects ||
        isLoadingTypes ||
        isLoadingUsers ||
        isLoadingSprints
      }
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
        {sortByRecent(projects ?? [], (p) => p.key, recentProjectKey).map(
          (project) => (
            <Form.Dropdown.Item
              key={project.key}
              value={project.key}
              title={`${project.name} (${project.key})`}
            />
          ),
        )}
      </Form.Dropdown>

      <Form.Dropdown
        id="issueType"
        title="Issue Type"
        defaultValue={recentIssueTypeId}
      >
        {sortByRecent(issueTypes ?? [], (t) => t.id, recentIssueTypeId).map(
          (type) => (
            <Form.Dropdown.Item
              key={type.id}
              value={type.id}
              title={type.name}
            />
          ),
        )}
      </Form.Dropdown>

      <Form.Dropdown
        id="assignee"
        title="Assignee"
        defaultValue={defaultAssignee}
      >
        <Form.Dropdown.Item key="unassigned" value="" title="Unassigned" />
        {sortByRecent(
          assignableUsers ?? [],
          (u) => u.accountId,
          recentAssigneeId,
        ).map((user) => (
          <Form.Dropdown.Item
            key={user.accountId}
            value={user.accountId}
            title={user.displayName}
            icon={user.avatarUrls["48x48"]}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="sprint" title="Sprint" defaultValue={defaultSprint}>
        <Form.Dropdown.Item key="none" value="" title="None" />
        {sprints.map((sprint) => (
          <Form.Dropdown.Item
            key={String(sprint.id)}
            value={String(sprint.id)}
            title={`${sprint.name} (${sprint.state})`}
          />
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
