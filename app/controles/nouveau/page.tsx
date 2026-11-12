import { exigerConnexion } from "@/lib/auth";
import { listerCours } from "@/lib/db";
import { iaLitLesImages } from "@/lib/ia";
import { Entete } from "@/components/entete";
import { FormulaireControle } from "@/components/formulaire-controle";

type Props = { searchParams: Promise<{ cours?: string }> };

export default async function PageNouveauControle({ searchParams }: Props) {
  const u = await exigerConnexion();
  const { cours } = await searchParams;
  const liste = listerCours(u.id).map((c) => ({ id: c.id, titre: c.titre, detail: c.matiere, photos: c.nbPhotos > 0 }));
  return (
    <main className="feuille">
      <Entete />
      <h1>
        <span className="surligne">Nouveau contrôle</span>
      </h1>
      <p className="discret">
        Un vrai contrôle, comme en classe : plusieurs types de questions, un barème sur 20, une durée si tu veux. Les réponses rédigées sont corrigées par l&apos;IA.
      </p>
      <FormulaireControle
        cours={liste}
        coursParDefaut={liste.some((c) => c.id === cours) ? cours! : ""}
        lecturePhotos={{ local: iaLitLesImages("local"), rapide: iaLitLesImages("rapide") }}
      />
    </main>
  );
}
