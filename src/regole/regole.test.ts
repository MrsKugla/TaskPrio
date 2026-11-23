import { describe, expect, it } from "vitest";
import {
  aggiungiDipendenza,
  bloccanti,
  bloccata,
  creaProgetto,
  creaTask,
  dipendenti,
  eliminaTask,
  modificaTask,
  rimuoviDipendenza,
  rinominaProgetto,
  ripristinaProgetto,
  type Progetto,
} from "./index";

const ora = new Date("2026-11-23T10:00:00.000Z");

describe("progetti e task", () => {
  it("crea un progetto e una task nel punto indicato", () => {
    const progetto = creaProgetto("Casa", ora);
    expect(progetto.tipo).toBe("ok");
    if (progetto.tipo !== "ok") return;

    const esito = creaTask(progetto.progetto, { titolo: "Comprare vernice", posizione: { x: 120, y: -40 } }, ora);

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.nome).toBe("Casa");
    expect(esito.progetto.task).toHaveLength(1);
    expect(esito.progetto.task[0]).toMatchObject({
      titolo: "Comprare vernice",
      posizione: { x: 120, y: -40 },
      creataIl: "2026-11-23T10:00:00.000Z",
    });
  });

  it("rifiuta un titolo vuoto e lascia il progetto com'era", () => {
    const progetto = creaProgetto("Casa", ora);
    if (progetto.tipo !== "ok") throw new Error("progetto non creato");

    const esito = creaTask(progetto.progetto, { titolo: "   ", posizione: { x: 0, y: 0 } }, ora);

    expect(esito.tipo).toBe("rifiutato");
    expect(progetto.progetto.task).toHaveLength(0);
  });

  it("rinomina un progetto senza toccare le sue task", () => {
    const creato = creaProgetto("Casa", ora);
    if (creato.tipo !== "ok") throw new Error("progetto non creato");
    const conTask = creaTask(creato.progetto, { titolo: "Imbiancare", posizione: { x: 0, y: 0 } }, ora);
    if (conTask.tipo !== "ok") throw new Error("task non creata");

    const esito = rinominaProgetto(conTask.progetto, "  Casa al mare ");

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.nome).toBe("Casa al mare");
    expect(esito.progetto.task.map((t) => t.titolo)).toEqual(["Imbiancare"]);
    expect(rinominaProgetto(conTask.progetto, "").tipo).toBe("rifiutato");
  });
});

function progettoConDueTask(): Progetto {
  const creato = creaProgetto("Casa", ora);
  if (creato.tipo !== "ok") throw new Error("progetto non creato");
  const prima = creaTask(creato.progetto, { titolo: "Imbiancare", posizione: { x: 0, y: 0 } }, ora);
  if (prima.tipo !== "ok") throw new Error("task non creata");
  const seconda = creaTask(prima.progetto, { titolo: "Pulire", posizione: { x: 100, y: 0 } }, ora);
  if (seconda.tipo !== "ok") throw new Error("task non creata");
  return seconda.progetto;
}

describe("attributi della task", () => {
  it("una task nuova nasce media, termometro blu, 1–4h, non atomica e senza descrizione", () => {
    const [task] = progettoConDueTask().task;
    expect(task).toMatchObject({
      descrizione: "",
      priorita: "media",
      costoFocus: "termometroBlu",
      costoTempo: "da1a4h",
      atomica: false,
    });
  });

  it("modifica tutti gli attributi di una task senza toccare le altre", () => {
    const progetto = progettoConDueTask();
    const [imbiancare, pulire] = progetto.task;

    const esito = modificaTask(progetto, imbiancare.id, {
      titolo: "  Imbiancare la cucina ",
      descrizione: "Due mani di bianco\n",
      priorita: "alta",
      costoFocus: "fuoco",
      costoTempo: "meno1h",
      atomica: true,
    });

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.task[0]).toEqual({
      id: imbiancare.id,
      titolo: "Imbiancare la cucina",
      descrizione: "Due mani di bianco\n",
      priorita: "alta",
      costoFocus: "fuoco",
      costoTempo: "meno1h",
      atomica: true,
      posizione: { x: 0, y: 0 },
      creataIl: "2026-11-23T10:00:00.000Z",
      stato: "daFare",
    });
    expect(esito.progetto.task[1]).toEqual(pulire);
  });

  it("modifica un solo attributo lasciando gli altri com'erano", () => {
    const progetto = progettoConDueTask();
    const esito = modificaTask(progetto, progetto.task[1].id, { costoTempo: "meno1h" });

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.task[1]).toEqual({ ...progetto.task[1], costoTempo: "meno1h" });
  });

  it("rifiuta un titolo vuoto o una task inesistente", () => {
    const progetto = progettoConDueTask();
    expect(modificaTask(progetto, progetto.task[0].id, { titolo: "  " }).tipo).toBe("rifiutato");
    expect(modificaTask(progetto, "inesistente", { priorita: "bassa" }).tipo).toBe("rifiutato");
    expect(progetto.task[0].titolo).toBe("Imbiancare");
  });

  it("completa con i valori iniziali le task salvate prima degli attributi", () => {
    const salvato = {
      id: "p1",
      nome: "Casa",
      creatoIl: "2026-11-01T10:00:00.000Z",
      task: [{ id: "t1", titolo: "Vecchia", posizione: { x: 5, y: 6 }, creataIl: "2026-11-01T10:00:00.000Z" }],
    };

    const progetto = ripristinaProgetto(salvato as unknown as Progetto);

    expect(progetto.task[0]).toEqual({
      id: "t1",
      titolo: "Vecchia",
      posizione: { x: 5, y: 6 },
      creataIl: "2026-11-01T10:00:00.000Z",
      descrizione: "",
      priorita: "media",
      costoFocus: "termometroBlu",
      costoTempo: "da1a4h",
      atomica: false,
      stato: "daFare",
    });
  });

  it("rifiuta atomica su una task oltre le 4h", () => {
    const progetto = progettoConDueTask();
    const lunga = modificaTask(progetto, progetto.task[0].id, { costoTempo: "da4a8h" });
    if (lunga.tipo !== "ok") throw new Error("modifica non riuscita");

    expect(modificaTask(lunga.progetto, progetto.task[0].id, { atomica: true }).tipo).toBe("rifiutato");
    expect(modificaTask(progetto, progetto.task[0].id, { atomica: true, costoTempo: "oltre8h" }).tipo).toBe("rifiutato");
  });

  it("una task atomica portata oltre le 4h smette di essere atomica", () => {
    const progetto = progettoConDueTask();
    const atomica = modificaTask(progetto, progetto.task[0].id, { atomica: true, costoTempo: "meno1h" });
    if (atomica.tipo !== "ok") throw new Error("modifica non riuscita");

    const esito = modificaTask(atomica.progetto, progetto.task[0].id, { costoTempo: "oltre8h" });

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.task[0]).toMatchObject({ costoTempo: "oltre8h", atomica: false });
  });
});

describe("eliminazione della task", () => {
  it("toglie la task dal progetto e lascia le altre", () => {
    const progetto = progettoConDueTask();
    const esito = eliminaTask(progetto, progetto.task[0].id);

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.task.map((t) => t.titolo)).toEqual(["Pulire"]);
    expect(progetto.task).toHaveLength(2);
  });

  it("rifiuta l'eliminazione di una task inesistente", () => {
    expect(eliminaTask(progettoConDueTask(), "inesistente").tipo).toBe("rifiutato");
  });
});

// Progetto con task dai titoli indicati, nell'ordine.
function progettoConTask(...titoli: string[]): Progetto {
  const creato = creaProgetto("Casa", ora);
  if (creato.tipo !== "ok") throw new Error("progetto non creato");
  return titoli.reduce((progetto, titolo, i) => {
    const esito = creaTask(progetto, { titolo, posizione: { x: i * 100, y: 0 } }, ora);
    if (esito.tipo !== "ok") throw new Error("task non creata");
    return esito.progetto;
  }, creato.progetto);
}

const id = (progetto: Progetto, titolo: string) => progetto.task.find((t) => t.titolo === titolo)!.id;
const titoli = (task: { titolo: string }[]) => task.map((t) => t.titolo);

// Applica le dipendenze in ordine; ogni coppia è [bloccante, dipendente].
function conDipendenze(progetto: Progetto, ...coppie: [string, string][]): Progetto {
  return coppie.reduce((p, [bloccante, dipendente]) => {
    const esito = aggiungiDipendenza(p, id(p, bloccante), id(p, dipendente));
    if (esito.tipo !== "ok") throw new Error(`dipendenza ${bloccante} → ${dipendente} rifiutata`);
    return esito.progetto;
  }, progetto);
}

describe("dipendenze", () => {
  it("la seconda task dipende dalla prima: la prima la blocca", () => {
    const progetto = conDipendenze(progettoConTask("Comprare vernice", "Imbiancare", "Pulire"), ["Comprare vernice", "Imbiancare"]);

    expect(titoli(dipendenti(progetto, id(progetto, "Comprare vernice")))).toEqual(["Imbiancare"]);
    expect(titoli(bloccanti(progetto, id(progetto, "Imbiancare")))).toEqual(["Comprare vernice"]);
    expect(bloccanti(progetto, id(progetto, "Comprare vernice"))).toEqual([]);
    expect(dipendenti(progetto, id(progetto, "Pulire"))).toEqual([]);
  });

  it("una task può bloccare e dipendere da quante task vuole", () => {
    const progetto = conDipendenze(
      progettoConTask("A", "B", "C", "D"),
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
      ["C", "D"],
      ["A", "D"],
    );

    expect(titoli(dipendenti(progetto, id(progetto, "A")))).toEqual(["B", "C", "D"]);
    expect(titoli(bloccanti(progetto, id(progetto, "D")))).toEqual(["A", "B", "C"]);
  });

  it("rifiuta una dipendenza già presente o verso una task che non è nel progetto", () => {
    const progetto = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);
    const altro = progettoConTask("Fuori");

    expect(aggiungiDipendenza(progetto, id(progetto, "A"), id(progetto, "B")).tipo).toBe("rifiutato");
    expect(aggiungiDipendenza(progetto, id(progetto, "A"), altro.task[0].id).tipo).toBe("rifiutato");
    expect(aggiungiDipendenza(progetto, altro.task[0].id, id(progetto, "B")).tipo).toBe("rifiutato");
  });

  it("rifiuta un cerchio diretto elencando le due task", () => {
    const progetto = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);

    const esito = aggiungiDipendenza(progetto, id(progetto, "B"), id(progetto, "A"));

    expect(esito.tipo).toBe("rifiutato");
    if (esito.tipo !== "rifiutato") return;
    expect(titoli(esito.cerchio ?? [])).toEqual(["A", "B"]);
  });

  it("rifiuta un cerchio indiretto elencando tutte le task nell'ordine del cerchio", () => {
    // Fuori blocca B e Vicolo dipende da B: toccano il cerchio ma non ne fanno parte.
    const progetto = conDipendenze(
      progettoConTask("Fuori", "Vicolo", "C", "B", "A"),
      ["A", "B"],
      ["B", "C"],
      ["Fuori", "B"],
      ["B", "Vicolo"],
    );

    const esito = aggiungiDipendenza(progetto, id(progetto, "C"), id(progetto, "A"));

    expect(esito.tipo).toBe("rifiutato");
    if (esito.tipo !== "rifiutato") return;
    expect(titoli(esito.cerchio ?? [])).toEqual(["A", "B", "C"]);
  });

  it("rifiuta una task che dipende da sé stessa", () => {
    const progetto = progettoConTask("A");
    const esito = aggiungiDipendenza(progetto, id(progetto, "A"), id(progetto, "A"));

    expect(esito.tipo).toBe("rifiutato");
    if (esito.tipo !== "rifiutato") return;
    expect(titoli(esito.cerchio ?? [])).toEqual(["A"]);
  });

  it("accetta due strade verso la stessa task, che non sono un cerchio", () => {
    const progetto = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["B", "C"]);
    expect(aggiungiDipendenza(progetto, id(progetto, "A"), id(progetto, "C")).tipo).toBe("ok");
  });

  it("rimuove una dipendenza lasciando le altre", () => {
    const progetto = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["A", "C"]);

    const esito = rimuoviDipendenza(progetto, id(progetto, "A"), id(progetto, "B"));

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(titoli(dipendenti(esito.progetto, id(progetto, "A")))).toEqual(["C"]);
    expect(rimuoviDipendenza(esito.progetto, id(progetto, "A"), id(progetto, "B")).tipo).toBe("rifiutato");
  });

  it("eliminare una task toglie anche le sue dipendenze, in entrambe le direzioni", () => {
    const progetto = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["B", "C"], ["A", "C"]);

    const esito = eliminaTask(progetto, id(progetto, "B"));

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(esito.progetto.dipendenze).toEqual([{ bloccanteId: id(progetto, "A"), dipendenteId: id(progetto, "C") }]);
  });
});

describe("bloccata", () => {
  it("una task è bloccata se dipende da almeno una task non fatta", () => {
    const progetto = conDipendenze(progettoConTask("A", "B", "C", "Libera"), ["A", "C"], ["B", "C"]);

    expect(bloccata(progetto, id(progetto, "C"))).toBe(true);
    expect(bloccata(progetto, id(progetto, "A"))).toBe(false);
    expect(bloccata(progetto, id(progetto, "Libera"))).toBe(false);
  });

  it("una task non è più bloccata quando tutte le task da cui dipende sono fatte", () => {
    const base = conDipendenze(progettoConTask("A", "B", "C"), ["A", "C"], ["B", "C"]);
    const segnaFatta = (p: Progetto, titolo: string): Progetto => ({
      ...p,
      task: p.task.map((t) => (t.titolo === titolo ? { ...t, stato: "fatta" } : t)),
    });

    const unaFatta = segnaFatta(base, "A");
    expect(bloccata(unaFatta, id(base, "C"))).toBe(true);
    expect(bloccata(segnaFatta(unaFatta, "B"), id(base, "C"))).toBe(false);
  });

  it("una task nuova nasce da fare", () => {
    expect(progettoConTask("A").task[0].stato).toBe("daFare");
  });

  it("completa i progetti salvati prima delle dipendenze e degli stati", () => {
    const salvato = {
      id: "p1",
      nome: "Casa",
      creatoIl: "2026-11-01T10:00:00.000Z",
      task: [{ id: "t1", titolo: "Vecchia", posizione: { x: 5, y: 6 }, creataIl: "2026-11-01T10:00:00.000Z" }],
    };

    const progetto = ripristinaProgetto(salvato as unknown as Progetto);

    expect(progetto.dipendenze).toEqual([]);
    expect(progetto.task[0].stato).toBe("daFare");
    expect(bloccata(progetto, "t1")).toBe(false);
  });
});
