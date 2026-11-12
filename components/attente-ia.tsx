"use client";

import { useEffect, useState } from "react";
import { PointsAttente, RobotLecteur } from "./robot-lecteur";

/** Écran d'attente pendant que l'IA travaille : le robot et des messages qui changent. */
export function AttenteIA({ messages }: { messages: string[] }) {
  const [etape, setEtape] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setEtape((e) => Math.min(e + 1, messages.length - 1)), 4500);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="attente" role="status" aria-live="polite">
      <RobotLecteur />
      <h2>
        {messages[etape]}
        <PointsAttente />
      </h2>
      <p className="discret petit">Ça peut prendre jusqu&apos;à une minute pour un long cours.</p>
    </div>
  );
}

/** Message d'erreur renvoyé par le site, avec le code de l'IA s'il y en a un. */
export function messageErreur(json: { erreur?: string; code?: string }, parDefaut: string): string {
  if (!json.erreur) return parDefaut;
  return json.code ? `Code ${json.code} : ${json.erreur}` : json.erreur;
}
