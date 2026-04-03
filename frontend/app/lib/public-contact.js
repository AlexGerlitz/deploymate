const defaultBusinessContactEmail = "alexgerlitz@users.noreply.github.com";

export const businessContactEmail =
  process.env.NEXT_PUBLIC_BUSINESS_CONTACT_EMAIL || defaultBusinessContactEmail;

export function buildBusinessMailto(subject) {
  return `mailto:${businessContactEmail}?subject=${encodeURIComponent(subject)}`;
}
