const DEVELOPMENT_API_URL = "http://localhost:3000";

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, "");

const rawApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL = rawApiUrl
    ? normalizeBaseUrl(rawApiUrl)
    : import.meta.env.DEV
        ? DEVELOPMENT_API_URL
        : (() => {
            throw new Error("Missing VITE_API_URL configuration for production build.");
        })();

export const apiUrl = (path: string): string => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};
