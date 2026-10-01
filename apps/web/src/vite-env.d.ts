declare module 'virtual:stylex:runtime';

declare module '*.css' {
  const css: string;
  export default css;
}

interface ImportMetaEnv {
  readonly VITE_CHECKOUT_URL_MONTHLY?: string;
  readonly VITE_CHECKOUT_URL_YEARLY?: string;
  readonly VITE_DOWNLOAD_URL?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_KEY?: string;
}
