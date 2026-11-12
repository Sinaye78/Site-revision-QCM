import type { Quiz } from "./quiz";

/** QCM factice pour tester le site sans clé d'IA (IA_DEMO=1). */
const QUESTIONS: Quiz["questions"] = [
  {
    question: "En quelle année a lieu la prise de la Bastille ?",
    choix: ["1789", "1792", "1799", "1804"],
    bonne_reponse: 0,
    explication: "La Bastille est prise le 14 juillet 1789, au tout début de la Révolution.",
    extrait: "Le 14 juillet 1789, le peuple de Paris s'empare de la Bastille.",
  },
  {
    question: "Quel texte est adopté le 26 août 1789 ?",
    choix: ["La Constitution de 1791", "La Déclaration des droits de l'homme et du citoyen", "Le Code civil", "Le serment du Jeu de paume"],
    bonne_reponse: 1,
    explication: "La Déclaration des droits de l'homme et du citoyen est adoptée le 26 août 1789 par l'Assemblée nationale.",
    extrait: "Le 26 août 1789, l'Assemblée adopte la Déclaration des droits de l'homme et du citoyen.",
  },
  {
    question: "Que se passe-t-il dans la nuit du 4 août 1789 ?",
    choix: ["Le roi s'enfuit à Varennes", "La République est proclamée", "Les privilèges sont abolis", "Louis XVI est exécuté"],
    bonne_reponse: 2,
    explication: "Dans la nuit du 4 août 1789, les députés votent l'abolition des privilèges.",
    extrait: "Dans la nuit du 4 août, les députés abolissent les privilèges.",
  },
  {
    question: "Où le roi est-il arrêté lors de sa fuite en 1791 ?",
    choix: ["À Versailles", "À Varennes", "À Lyon", "À Marseille"],
    bonne_reponse: 1,
    explication: "Louis XVI tente de fuir à l'étranger en juin 1791 mais il est reconnu et arrêté à Varennes.",
    extrait: "En juin 1791, la famille royale est arrêtée à Varennes.",
  },
  {
    question: "Quand la République est-elle proclamée en France ?",
    choix: ["Juillet 1789", "Juin 1791", "Septembre 1792", "Janvier 1793"],
    bonne_reponse: 2,
    explication: "La Première République est proclamée le 21 septembre 1792, après la chute de la monarchie.",
    extrait: "Le 21 septembre 1792, la Convention proclame la République.",
  },
];

export function quizDemo(nombre: number): Quiz {
  const questions = Array.from({ length: nombre }, (_, i) => QUESTIONS[i % QUESTIONS.length]);
  return { titre: "La Révolution française (démo)", matiere: "Histoire", questions };
}
