/**
 * Utility for managing the Bot API URL.
 * Defaults to localhost (127.0.0.1:3001) but can be configured by the user
 * to connect to an external server (e.g., local network IP or Ngrok domain).
 */

const STORAGE_KEY = 'autotech_bot_api_url';
const DEFAULT_URL = 'http://127.0.0.1:3001';

export const getBotApiUrl = (): string => {
  try {
    const storedUrl = localStorage.getItem(STORAGE_KEY);
    return storedUrl || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
};

export const setBotApiUrl = (url: string): void => {
  // Normalize URL (remove trailing slashes)
  const normalizedUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, normalizedUrl);
};
