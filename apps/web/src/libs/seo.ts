/**
 * The server writes the root-resume shell's canonical link into the HTML it sends (apps/server/src/static/web.ts).
 * Routes only set what changes as the visitor navigates: the title, the description and, where needed, `noindex`.
 */
export const createNoindexFollowMeta = () => ({ name: "robots", content: "noindex, follow" });
