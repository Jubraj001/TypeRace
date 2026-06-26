/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RACE_SERVER?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
