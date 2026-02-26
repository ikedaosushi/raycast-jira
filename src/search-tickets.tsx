import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import {
  assignIssue,
  getAssignableUsers,
  getIssueUrl,
  getProjects,
  JiraIssue,
  JiraProject,
  searchIssues,
  searchUsers,
} from "./api";

type ProjectFilter = string;

export default function SearchTickets() {
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("currentUser");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [selectedFilterItem, setSelectedFilterItem] = useState<string>(
    "assignee:currentUser",
  );

  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(
    getProjects,
    [],
    {
      keepPreviousData: true,
    },
  );

  const { data: users, isLoading: isLoadingUsers } = useCachedPromise(
    searchUsers,
    [],
    {
      keepPreviousData: true,
    },
  );

  const {
    data: issues,
    isLoading,
    revalidate,
  } = useCachedPromise(searchIssues, [query, assigneeFilter, projectFilter], {
    keepPreviousData: true,
  });

  function handleFilterChange(value: string) {
    setSelectedFilterItem(value);
    if (value.startsWith("assignee:")) {
      setAssigneeFilter(value.replace("assignee:", ""));
      return;
    }
    if (value.startsWith("project:")) {
      setProjectFilter(value.replace("project:", ""));
    }
  }

  return (
    <List
      isLoading={isLoading || isLoadingProjects || isLoadingUsers}
      searchBarPlaceholder="Search Jira tickets..."
      onSearchTextChange={setQuery}
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter"
          value={selectedFilterItem}
          onChange={handleFilterChange}
        >
          <List.Dropdown.Section title="Assignee">
            <List.Dropdown.Item
              title="Assigned to Me"
              value="assignee:currentUser"
            />
            <List.Dropdown.Item title="All" value="assignee:all" />
            <List.Dropdown.Item
              title="Unassigned"
              value="assignee:unassigned"
            />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Members">
            {users?.map((user) => (
              <List.Dropdown.Item
                key={user.accountId}
                title={user.displayName}
                value={`assignee:${user.accountId}`}
                icon={user.avatarUrls["48x48"]}
              />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Project">
            <List.Dropdown.Item
              title="All Projects"
              value="project:all"
            />
            {projects?.map((project: JiraProject) => (
              <List.Dropdown.Item
                key={project.key}
                title={`${project.key} - ${project.name}`}
                value={`project:${project.key}`}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {issues?.map((issue) => (
        <List.Item
          key={issue.key}
          title={issue.fields.summary}
          subtitle={issue.key}
          accessories={[
            {
              tag: {
                value: issue.fields.status.name,
                color: getStatusColor(issue.fields.status.name),
              },
            },
            {
              text: issue.fields.project.key,
            },
            ...(issue.fields.assignee
              ? [
                  {
                    icon: issue.fields.assignee.avatarUrls["48x48"],
                    tooltip: issue.fields.assignee.displayName,
                  },
                ]
              : []),
          ]}
          icon={issue.fields.issuetype.iconUrl ?? Icon.Document}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="Open in Jira"
                url={getIssueUrl(issue.key)}
              />
              <ChangeAssigneeSubmenu issue={issue} onChanged={revalidate} />
              <Action.CopyToClipboard
                title="Copy Issue Key"
                content={issue.key}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
              <Action.CopyToClipboard
                title="Copy Issue URL"
                content={getIssueUrl(issue.key)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function ChangeAssigneeSubmenu({
  issue,
  onChanged,
}: {
  issue: JiraIssue;
  onChanged: () => void;
}) {
  const { data: users, isLoading } = useCachedPromise(getAssignableUsers, [
    issue.fields.project.key,
  ]);

  async function handleAssign(accountId: string | null, displayName: string) {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Changing assignee...",
      });
      await assignIssue(issue.key, accountId);
      await showToast({
        style: Toast.Style.Success,
        title: `Assigned to ${displayName}`,
      });
      onChanged();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to change assignee",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <ActionPanel.Submenu
      title="Change Assignee"
      icon={Icon.PersonCircle}
      shortcut={{ modifiers: ["cmd"], key: "a" }}
    >
      <Action
        title="Unassigned"
        icon={Icon.XMarkCircle}
        onAction={() => handleAssign(null, "Unassigned")}
      />
      {isLoading && (
        <Action title="Loading..." icon={Icon.Clock} onAction={() => {}} />
      )}
      {users?.map((user) => (
        <Action
          key={user.accountId}
          title={user.displayName}
          icon={user.avatarUrls["48x48"]}
          onAction={() => handleAssign(user.accountId, user.displayName)}
        />
      ))}
    </ActionPanel.Submenu>
  );
}

function getStatusColor(status: string): Color {
  const lower = status.toLowerCase();
  if (lower === "done" || lower === "closed" || lower === "resolved")
    return Color.Green;
  if (lower === "in progress" || lower === "in review") return Color.Blue;
  if (lower === "to do" || lower === "open" || lower === "backlog")
    return Color.Orange;
  return Color.SecondaryText;
}
