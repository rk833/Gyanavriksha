const STORAGE_KEY = 'gv_theme_preference';
const DENSITY_KEY = 'gv_density_preference';

function resolveSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference = 'system') {
  const resolved = preference === 'system' ? resolveSystemTheme() : preference;
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem(STORAGE_KEY, preference);
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'system';
  applyTheme(saved);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    const pref = localStorage.getItem(STORAGE_KEY) || 'system';
    if (pref === 'system') applyTheme('system');
  };
  if (media.addEventListener) {
    media.addEventListener('change', listener);
  } else {
    media.addListener(listener);
  }
}

export function applyDensity(preference = 'comfortable') {
  const allowed = new Set(['compact', 'comfortable', 'spacious']);
  const value = allowed.has(preference) ? preference : 'comfortable';
  document.documentElement.setAttribute('data-density', value);
  localStorage.setItem(DENSITY_KEY, value);
}

export function initDensity() {
  const saved = localStorage.getItem(DENSITY_KEY) || 'comfortable';
  applyDensity(saved);
}

