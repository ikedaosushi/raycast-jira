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

export async function searchIssues(query: string): Promise<JiraIssue[]> {
  const baseUrl = getBaseUrl();
  const jql = query.trim()
    ? `text ~ "${query.trim()}" ORDER BY updated DESC`
    : "assignee = currentUser() ORDER BY updated DESC";
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
): Promise<{ key: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue`;

  const body: Record<string, unknown> = {
    fields: {
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
    },
  };

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

export function getIssueUrl(issueKey: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/browse/${issueKey}`;
}
