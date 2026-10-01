/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LICENSE_BYPASS?: string;
  readonly VITE_POLAR_API_BASE: string;
  readonly VITE_POLAR_CHECKOUT_URL: string;
  readonly VITE_POLAR_ORGANIZATION_ID: string;
  readonly VITE_POLAR_PORTAL_URL: string;
}
