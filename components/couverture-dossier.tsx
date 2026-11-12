import { chemin } from "@/lib/chemin";

/** Couverture de cahier : couleur, image éventuelle et étiquette avec le nom. */
export function CouvertureDossier({
  nom,
  couleur,
  image,
  sousTitre,
  grande = false,
}: {
  nom: string;
  couleur: string;
  image: string | null;
  sousTitre?: string;
  grande?: boolean;
}) {
  return (
    <div className={`couverture couleur-${couleur}${grande ? " grande" : ""}`}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="couverture-image" src={chemin(`/api/fichiers/${image}`)} alt="" />
      )}
      <div className="etiquette-cahier">
        <span className="etiquette-nom">{nom}</span>
        {sousTitre && <span className="etiquette-sous">{sousTitre}</span>}
      </div>
    </div>
  );
}
