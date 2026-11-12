import { chemin } from "@/lib/chemin";

/**
 * Le robot qui lit pendant que l'IA prépare le QCM : il se balance doucement.
 * Le balancement est sur l'image elle-même (et pas sur un parent), sinon son
 * fond blanc ne pourrait plus se fondre dans le papier.
 */
export function RobotLecteur() {
  return (
    <div className="robot" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="robot-balance" src={chemin("/illustrations/attente.webp")} alt="" width={1536} height={1024} />
    </div>
  );
}

/** Trois points qui sautillent l'un après l'autre, à la fin d'une phrase. */
export function PointsAttente() {
  return (
    <span className="points-attente" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}
