/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Jira Domain - Your Jira domain (e.g. your-company.atlassian.net) */
  "domain": string,
  /** Email - Your Atlassian account email */
  "email": string,
  /** API Token - Your Atlassian API token (https://id.atlassian.com/manage-profile/security/api-tokens) */
  "apiToken": string,
  /** OpenAI API Key - OpenAI API key for AI-assisted ticket creation */
  "openaiApiKey": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-tickets` command */
  export type SearchTickets = ExtensionPreferences & {}
  /** Preferences accessible in the `create-ticket` command */
  export type CreateTicket = ExtensionPreferences & {}
  /** Preferences accessible in the `open-project` command */
  export type OpenProject = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-tickets` command */
  export type SearchTickets = {}
  /** Arguments passed to the `create-ticket` command */
  export type CreateTicket = {}
  /** Arguments passed to the `open-project` command */
  export type OpenProject = {}
}

