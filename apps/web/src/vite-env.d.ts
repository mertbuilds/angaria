declare module 'virtual:stylex:runtime';

declare module '*.css' {
  const css: string;
  export default css;
}

interface ImportMetaEnv {
  readonly VITE_DOWNLOAD_URL?: string;
  readonly VITE_OPENPANEL_CLIENT_ID?: string;
}
