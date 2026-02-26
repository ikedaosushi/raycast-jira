import {
  Action,
  ActionPanel,
  Icon,
  List,
  LocalStorage,
  open,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import { getProjects, getProjectUrl, JiraProject } from "./api";

const RECENT_OPEN_PROJECT_KEYS = "recentOpenProjectKeys";

function sortProjectsByRecent(
  projects: JiraProject[],
  recentKeys: string[],
): JiraProject[] {
  if (recentKeys.length === 0) return projects;

  const rank = new Map(recentKeys.map((key, index) => [key, index]));
  return [...projects].sort((a, b) => {
    const aRank = rank.get(a.key);
    const bRank = rank.get(b.key);

    if (aRank === undefined && bRank === undefined) return 0;
    if (aRank === undefined) return 1;
    if (bRank === undefined) return -1;
    return aRank - bRank;
  });
}

export default function OpenProject() {
  const { data: projects, isLoading } = useCachedPromise(getProjects, [], {
    keepPreviousData: true,
  });
  const [recentKeys, setRecentKeys] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const saved = await LocalStorage.getItem<string>(
        RECENT_OPEN_PROJECT_KEYS,
      );
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentKeys(
            parsed.filter((key): key is string => typeof key === "string"),
          );
        }
      } catch {
        // ignore invalid local storage value
      }
    })();
  }, []);

  const sortedProjects = useMemo(
    () => sortProjectsByRecent(projects ?? [], recentKeys),
    [projects, recentKeys],
  );

  async function trackProjectOpen(projectKey: string) {
    const updated = [
      projectKey,
      ...recentKeys.filter((key) => key !== projectKey),
    ].slice(0, 20);
    setRecentKeys(updated);
    await LocalStorage.setItem(
      RECENT_OPEN_PROJECT_KEYS,
      JSON.stringify(updated),
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search projects..."
      filtering
    >
      {sortedProjects.map((project: JiraProject) => (
        <ProjectItem
          key={project.key}
          project={project}
          onOpen={trackProjectOpen}
        />
      ))}
    </List>
  );
}

function ProjectItem({
  project,
  onOpen,
}: {
  project: JiraProject;
  onOpen: (projectKey: string) => Promise<void>;
}) {
  const { data: url } = useCachedPromise(getProjectUrl, [
    project.key,
    project.projectTypeKey,
  ]);

  async function handleOpen() {
    if (!url) return;
    await onOpen(project.key);
    await open(url);
  }

  return (
    <List.Item
      title={project.name}
      subtitle={project.key}
      icon={Icon.FolderOpen}
      actions={
        url ? (
          <ActionPanel>
            <Action title="Open in Jira" onAction={handleOpen} />
            <Action.CopyToClipboard
              title="Copy Project Key"
              content={project.key}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Project URL"
              content={url}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
