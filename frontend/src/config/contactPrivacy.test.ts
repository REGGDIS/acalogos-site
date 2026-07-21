import { describe, expect, it } from "vitest";
import {
  MAX_PRIVACY_NOTICE_VERSION_LENGTH,
  normalizeContactPrivacyNoticeVersion,
} from "./contactPrivacy";

describe("normalizeContactPrivacyNoticeVersion", () => {
  it("conserva literalmente una versión pública válida", () => {
    const value = "contact-v1";
    expect(normalizeContactPrivacyNoticeVersion(value)).toBe(value);
  });

  it("rechaza valores ausentes, vacíos, con espacios exteriores, demasiado largos o con NUL", () => {
    expect(normalizeContactPrivacyNoticeVersion(undefined)).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion("")).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion("   ")).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion(" contact-v1")).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion("contact-v1 ")).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion("v".repeat(MAX_PRIVACY_NOTICE_VERSION_LENGTH + 1))).toBeNull();
    expect(normalizeContactPrivacyNoticeVersion("contact\u0000-v1")).toBeNull();
  });
});
