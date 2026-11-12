/** Dates affichées à l'élève, à l'heure de Paris. */
const formatJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** « demain », « après-demain » ou « le mardi 18 novembre », pour un jour AAAA-MM-JJ. */
export function formaterJour(jour: string, aujourdhui?: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  const cible = Date.UTC(a, m - 1, j);
  const base = aujourdhui ?? new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(Date.now());
  const [ba, bm, bj] = base.split("-").map(Number);
  const ecart = Math.round((cible - Date.UTC(ba, bm - 1, bj)) / 86_400_000);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === 2) return "après-demain";
  return `le ${formatJourLong.format(cible)}`;
}
