import schedule from "./release-schedule.json";
export { schedule };
export const releaseEpisodes: Record<string, number> = Object.fromEntries(schedule.releases.map(r => [r.date, r.episode]));

export function releaseCountdown(now: Date) {
  const next = schedule.releases.find(r => new Date(r.at).getTime() >= now.getTime());
  if (!next) return { next: null, label: "Season release schedule complete" };
  const hours = Math.ceil((new Date(next.at).getTime() - now.getTime()) / 3600000);
  const days = Math.floor(hours / 24);
  const label = days > 0 ? `${days} ${days === 1 ? "day" : "days"} until Episode ${next.episode}`
    : hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"} until Episode ${next.episode}` : `Episode ${next.episode} is due now`;
  return { next, label };
}
