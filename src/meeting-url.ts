export const meetingUrlPatterns = {
  zoom: /https:\/\/([\w.-]*\.)?zoom\.us\/j\/\d+[^\s<"]*/,
  teams: /https:\/\/teams\.microsoft\.com\/meet\/[^\s<"]*/,
  meet: /https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+/,
};

export function findMeetingUrl(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  for (const pattern of Object.values(meetingUrlPatterns)) {
    const m = text.match(pattern);
    if (m) return m[0];
  }
  return undefined;
}
