export function formatDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
export function formatTime(d: string | null) {
  return d ? d.slice(11, 16) : "—";
}
