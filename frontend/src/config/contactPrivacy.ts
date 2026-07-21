export const MAX_PRIVACY_NOTICE_VERSION_LENGTH = 32;

export const normalizeContactPrivacyNoticeVersion = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  if (
    value.length === 0
    || value.length > MAX_PRIVACY_NOTICE_VERSION_LENGTH
    || value !== value.trim()
    || value.includes("\u0000")
  ) {
    return null;
  }

  return value;
};
