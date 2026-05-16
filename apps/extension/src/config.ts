export type ExtensionConfig = {
  apiBaseUrl: string;
  webAppBaseUrl: string;
  devUserEmail: string;
  useDevAuthHeader: boolean;
};

export const extensionConfig: ExtensionConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://localhost:3000",
  webAppBaseUrl:
    import.meta.env.VITE_WEB_APP_BASE_URL?.toString() ??
    "http://localhost:5173",
  devUserEmail:
    import.meta.env.VITE_DEV_USER_EMAIL?.toString() ?? "beta@example.com",
  useDevAuthHeader: import.meta.env.VITE_USE_DEV_AUTH_HEADER === "true",
};
