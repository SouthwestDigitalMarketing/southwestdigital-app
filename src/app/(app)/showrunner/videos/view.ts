export type View = "detailed" | "condensed";

/** Set by AllVideosBrowser, read by page.tsx so the page opens in the last view chosen on this device. */
export const VIEW_COOKIE = "swapp_videos_view";
