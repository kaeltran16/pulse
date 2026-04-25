const baseUrl = process.env.EXPO_PUBLIC_PAL_BASE_URL ?? "";
const token = process.env.EXPO_PUBLIC_PAL_TOKEN ?? "";

if (!baseUrl) console.warn("[pal] EXPO_PUBLIC_PAL_BASE_URL not set");
if (!token) console.warn("[pal] EXPO_PUBLIC_PAL_TOKEN not set");

export const PAL_BASE_URL = baseUrl;
export const PAL_TOKEN = token;
