import type { IAppConfig } from "../appConfig";

/** What the navigation check needs from the app configuration. */
export type INavigationConfig = Pick<IAppConfig, "isDev" | "rendererUrl" | "rendererHtmlPath">;
