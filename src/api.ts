import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  domain: string;
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string; avatarUrls: { "48x48": string } } | null;
    issuetype: { name: string; iconUrl: string };
    priority: { name: string; iconUrl: string } | null;
    project: { key: string; name: string };
    created: string;
    updated: string;
  };
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  avatarUrls: { "48x48": string };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
}

export interface JiraBoard {
  id: number;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

function getAuthHeader(): { Authorization: string; "Content-Type": string } {
  const { email, apiToken } = getPreferenceValues<Preferences>();
  const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(): string {
  const { domain } = getPreferenceValues<Preferences>();
  const d = domain.replace(/\/+$/, "");
  return d.startsWith("http") ? d : `https://${d}`;
}

export async function searchIssues(
  query: string,
  assigneeFilter: "currentUser" | "all" | "unassigned" = "currentUser",
): Promise<JiraIssue[]> {
  const baseUrl = getBaseUrl();
  const conditions: string[] = [];
  if (query.trim()) {
    conditions.push(`text ~ "${query.trim()}"`);
  }
  if (assigneeFilter === "currentUser") {
    conditions.push("assignee = currentUser()");
  } else if (assigneeFilter === "unassigned") {
    conditions.push("assignee is EMPTY");
  }
  const jql =
    (conditions.length > 0 ? conditions.join(" AND ") : "") +
    " ORDER BY updated DESC";
  const fields =
    "summary,status,assignee,issuetype,priority,project,created,updated";
  const url = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${fields}`;

  const response = await fetch(url, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jira API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return (data as { issues: JiraIssue[] }).issues ?? [];
}

export async function getProjects(): Promise<JiraProject[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/project/search?maxResults=100&orderBy=name`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { values: JiraProject[] };
  return data.values;
}

export async function getIssueTypes(
  projectId: string,
): Promise<JiraIssueType[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/project/${projectId}/statuses`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    id: string;
    name: string;
    description?: string;
  }[];
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
  }));
}

export async function getIssueTypesForProject(
  projectKey: string,
): Promise<JiraIssueType[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue/createmeta/${projectKey}/issuetypes`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    issueTypes?: JiraIssueType[];
    values?: JiraIssueType[];
  };
  return data.issueTypes ?? data.values ?? [];
}

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
    ...(assigneeAccountId
      ? { assignee: { accountId: assigneeAccountId } }
      : {}),
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

export async function getAssignableUsers(
  projectKey: string,
): Promise<JiraUser[]> {
  const baseUrl = getBaseUrl();
  const allUsers: JiraUser[] = [];
  let startAt = 0;
  const maxResults = 1000;

  while (true) {
    const url = `${baseUrl}/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&startAt=${startAt}&maxResults=${maxResults}`;
    const response = await fetch(url, { headers: getAuthHeader() });

    if (!response.ok) {
      throw new Error(
        `Jira API error: ${response.status} ${response.statusText}`,
      );
    }

    const users = (await response.json()) as JiraUser[];
    allUsers.push(...users);

    if (users.length < maxResults) break;
    startAt += maxResults;
  }

  return allUsers;
}

export async function getCurrentUser(): Promise<JiraUser> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/myself`;

  const response = await fetch(url, { headers: getAuthHeader() });

  if (!response.ok) {
    throw new Error(
      `Jira API error: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as JiraUser;
}

export async function assignIssue(
  issueKey: string,
  accountId: string | null,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue/${issueKey}/assignee`;

  const response = await fetch(url, {
    method: "PUT",
    headers: getAuthHeader(),
    body: JSON.stringify({ accountId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jira API error: ${response.status} ${errorBody}`);
  }
}

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

export function getIssueUrl(issueKey: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/browse/${issueKey}`;
}
