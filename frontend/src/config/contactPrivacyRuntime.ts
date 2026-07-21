import { normalizeContactPrivacyNoticeVersion } from "./contactPrivacy";

export const getContactPrivacyNoticeVersion = (): string | null => (
  normalizeContactPrivacyNoticeVersion(import.meta.env.VITE_CONTACT_PRIVACY_NOTICE_VERSION)
);
