const POLARIS_API_ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'polaris://app',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:5173',
  'http://127.0.0.1',
  'https://127.0.0.1',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173'
]);

export function isAllowedPolarisApiOrigin(origin: string) {
  if (POLARIS_API_ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}
