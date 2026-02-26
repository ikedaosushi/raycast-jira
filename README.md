# Jira Tools for Raycast

A Raycast extension to search Jira tickets, create AI-assisted tickets, and open projects — all from your keyboard.

## Features

- **Search Tickets** — Search Jira issues by keyword with filters for assignee and project. Change assignees and copy issue keys/URLs directly from the results.
- **Create Ticket (AI-assisted)** — Describe what you want to do in plain text. OpenAI generates a polished summary and description, which you can review and edit before creating the ticket. Automatically assigns to you and selects the active sprint.
- **Open Project** — Quickly open a Jira project in your browser.

## Requirements

- [Raycast](https://raycast.com/) installed
- Jira Cloud account
- Atlassian API token
- OpenAI API key

## Installation

This extension is not yet published to the Raycast Store. Install it locally:

```bash
git clone https://github.com/ikedaosushi/raycast-jira.git
cd raycast-jira
npm install
npm run dev
```

Running `npm run dev` opens Raycast and registers the extension in development mode.

## Configuration

Open Raycast preferences for this extension and fill in the following fields:

| Field | Description |
|-------|-------------|
| **Jira Domain** | Your Atlassian domain, e.g. `your-company.atlassian.net` |
| **Email** | Your Atlassian account email address |
| **API Token** | Atlassian API token — generate one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| **OpenAI API Key** | Your OpenAI API key for AI-assisted ticket creation |

## Commands

### Search Tickets

Search across your Jira projects by keyword. Use the dropdown to filter by:

- **Assignee** — Assigned to me, all, unassigned, or a specific team member
- **Project** — Filter by a specific Jira project

**Actions available on each result:**

| Action | Shortcut |
|--------|----------|
| Open in Jira | Enter |
| Change Assignee | ⌘A |
| Copy Issue Key | ⌘C |
| Copy Issue URL | ⌘⇧C |

### Create Ticket

A two-step AI-assisted ticket creation flow:

1. **Step 1** — Select project, issue type, assignee, and sprint. Then describe what you want to build in plain text.
2. **Step 2** — Review the AI-generated summary and description. Edit as needed, then submit.

The assignee defaults to the current user and the sprint defaults to the active sprint.

### Open Project

Opens your Jira project dashboard in the default browser.

## License

MIT
