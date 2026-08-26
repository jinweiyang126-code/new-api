/*
Copyright (C) 2023-2026 QuantumNous
*/

/** Hide the inline OAuth boot loader from index.html once React mounts. */
export function hideBootOAuthLoader(): void {
  if (typeof document === 'undefined') return
  const loader = document.getElementById('boot-oauth-loader')
  if (loader) loader.hidden = true
}
