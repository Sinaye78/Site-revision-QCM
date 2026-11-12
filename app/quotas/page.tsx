import { Entete } from "@/components/entete";
import { chemin } from "@/lib/chemin";
import { exigerConnexion } from "@/lib/auth";
import { etatFournisseursIA } from "@/lib/ia";
import { lireUsageIA } from "@/lib/usage-ia";

// Allocation quotidienne incluse : https://developers.cloudflare.com/workers-ai/platform/pricing/
const ALLOCATION_QUOTIDIENNE = 10_000;
export default async function PageQuotas() {
  await exigerConnexion();
  const usage = lireUsageIA();
  const actifs = etatFournisseursIA();
  const cloudflare = actifs.some(f => f.id === "cloudflare");
  const secours = actifs.some(f => f.id === "compat" || f.id === "ollama");
  const jour = usage.jour.find(f => f.fournisseur === "cloudflare");
  const mesure = !jour || jour.neurones !== null;
  const pourcentage = ((jour?.neurones ?? 0) / ALLOCATION_QUOTIDIENNE) * 100;
  const affichage = pourcentage > 0 && pourcentage < 0.1 ? "< 0,1" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(pourcentage);
  const maintenant = new Date();
  const demain = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() + 1));
  const heure = demain.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return <main className="feuille">
    <Entete />
    <div className="titre-page"><h1><span className="surligne">Quota des IA</span></h1><a href={chemin("/quotas")} className="bouton">Actualiser</a></div>
    <p className="discret">Un coup d&apos;œil sur l&apos;utilisation du jour.</p>
    {cloudflare && <section className="carte quota-simple">
      <div className="quota-simple-entete"><h2>Cloudflare</h2><span className="quota-pastille">IA principale</span></div>
      {mesure ? <>
        <p className="quota-pourcentage">{affichage}<span> %</span></p>
        <p className="quota-legende">du quota quotidien utilisé par Révision</p>
        <progress className={"quota-jauge" + (pourcentage >= 90 ? " quota-jauge-haute" : "")} max={100} value={Math.min(100, pourcentage)} aria-label="Part du quota quotidien utilisée par Révision" />
        <p className="quota-message">{pourcentage >= 100 ? "L’enveloppe quotidienne incluse a été utilisée." : pourcentage >= 80 ? "L’enveloppe quotidienne est bientôt utilisée." : "Tu peux continuer à réviser."}</p>
      </> : <p className="quota-message">Le niveau d&apos;utilisation est momentanément indisponible.</p>}
      <p className="petit discret">Nouveau quota chaque jour à {heure}, heure de Paris.</p>
      <p className="petit discret quota-precision">Ce pourcentage mesure l&apos;utilisation de Révision dans l&apos;enveloppe quotidienne incluse.</p>
    </section>}
    {secours && <div className="quota-secours"><span aria-hidden="true">✓</span><p>Une IA de secours est aussi disponible.</p></div>}
    {!cloudflare && <div className="carte"><p>Le pourcentage d&apos;utilisation n&apos;est pas encore disponible.</p></div>}
  </main>;
}
