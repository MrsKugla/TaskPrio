import { describe, expect, it } from "vitest";
import {
  aggiungiDipendenza,
  applicaPrestoAlta,
  bloccanti,
  bloccata,
  cambiaStato,
  creaProgetto,
  creaTask,
  dipendenti,
  eliminaTask,
  FILTRI_INIZIALI,
  modificaTask,
  INGOMBRO_TASK,
  prioritaEffettive,
  rimuoviDipendenza,
  rinominaProgetto,
  riapri,
  riordina,
  taskInFocus,
  taskVisibili,
  ripristinaProgetto,
  aggiungiRischio,
  aggiungiTest,
  eliminaRischio,
  eliminaTest,
  haRischiAperti,
  impostaEsito,
  impostaPianoB,
  modificaRischio,
  modificaTest,
  pianiBDaEseguire,
  rimuoviPianoB,
  spostaNodoCatena,
  type AttributiTask,
  type Esito,
  type Filtri,
  type Priorita,
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
      rischi: [],
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
      rischi: [],
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

// Porta le task indicate allo stato voluto, confermando gli eventuali controsensi.
function conStato(progetto: Progetto, stato: "inCorso" | "fatta", ...nomi: string[]): Progetto {
  return nomi.reduce((p, nome) => {
    const esito = cambiaStato(p, id(p, nome), stato, { confermato: true });
    if (esito.tipo !== "ok") throw new Error(`stato di ${nome} non cambiato`);
    return esito.progetto;
  }, progetto);
}

const statoDi = (progetto: Progetto, titolo: string) => progetto.task.find((t) => t.titolo === titolo)!.stato;

describe("stati", () => {
  it("una task libera passa da fare → in corso → fatta senza conferme", () => {
    const progetto = progettoConTask("A", "B");

    const inCorso = cambiaStato(progetto, id(progetto, "A"), "inCorso");
    expect(inCorso.tipo).toBe("ok");
    if (inCorso.tipo !== "ok") return;
    expect(statoDi(inCorso.progetto, "A")).toBe("inCorso");
    expect(statoDi(inCorso.progetto, "B")).toBe("daFare");

    const fatta = cambiaStato(inCorso.progetto, id(progetto, "A"), "fatta");
    expect(fatta.tipo).toBe("ok");
    if (fatta.tipo !== "ok") return;
    expect(statoDi(fatta.progetto, "A")).toBe("fatta");
  });

  it("una task in corso può tornare da fare", () => {
    const progetto = conStato(progettoConTask("A"), "inCorso", "A");
    const esito = cambiaStato(progetto, id(progetto, "A"), "daFare");

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(statoDi(esito.progetto, "A")).toBe("daFare");
  });

  it("una task fatta non cambia stato né attributi finché non si riapre", () => {
    const progetto = conStato(progettoConTask("A"), "fatta", "A");

    expect(cambiaStato(progetto, id(progetto, "A"), "inCorso").tipo).toBe("rifiutato");
    expect(cambiaStato(progetto, id(progetto, "A"), "daFare").tipo).toBe("rifiutato");
    expect(modificaTask(progetto, id(progetto, "A"), { titolo: "Altro" }).tipo).toBe("rifiutato");
  });

  it("«Riapri» porta una task fatta in corso", () => {
    const progetto = conStato(progettoConTask("A"), "fatta", "A");
    const esito = riapri(progetto, id(progetto, "A"));

    expect(esito.tipo).toBe("ok");
    if (esito.tipo !== "ok") return;
    expect(statoDi(esito.progetto, "A")).toBe("inCorso");
    expect(modificaTask(esito.progetto, id(progetto, "A"), { titolo: "Altro" }).tipo).toBe("ok");
  });

  it("rifiuta di riaprire una task non fatta o inesistente", () => {
    const progetto = progettoConTask("A");
    expect(riapri(progetto, id(progetto, "A")).tipo).toBe("rifiutato");
    expect(riapri(progetto, "inesistente").tipo).toBe("rifiutato");
    expect(cambiaStato(progetto, "inesistente", "fatta").tipo).toBe("rifiutato");
  });
});

describe("controsensi", () => {
  it("segnare fatta una task che dipende da una non fatta chiede conferma e nomina le task aperte", () => {
    const progetto = conDipendenze(progettoConTask("Vernice", "Pennelli", "Imbiancare"), ["Vernice", "Imbiancare"], ["Pennelli", "Imbiancare"]);
    const conUnaFatta = conStato(progetto, "fatta", "Pennelli");

    const esito = cambiaStato(conUnaFatta, id(progetto, "Imbiancare"), "fatta");

    expect(esito.tipo).toBe("richiedeConferma");
    if (esito.tipo !== "richiedeConferma") return;
    expect(esito.controsenso).toContain("Vernice");
    expect(esito.controsenso).not.toContain("Pennelli");
  });

  it("mettere in corso una task bloccata chiede conferma", () => {
    const progetto = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);
    expect(cambiaStato(progetto, id(progetto, "B"), "inCorso").tipo).toBe("richiedeConferma");
  });

  it("riaprire una task da cui dipendono task già fatte chiede conferma e nomina quelle fatte", () => {
    const base = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["A", "C"]);
    const progetto = conStato(base, "fatta", "A", "B");

    const esito = riapri(progetto, id(progetto, "A"));

    expect(esito.tipo).toBe("richiedeConferma");
    if (esito.tipo !== "richiedeConferma") return;
    expect(esito.controsenso).toContain("B");
    expect(esito.controsenso).not.toContain("C");
  });

  it("confermando, ognuno dei tre controsensi si applica", () => {
    const base = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);
    const opzioni = { confermato: true };

    const inCorso = cambiaStato(base, id(base, "B"), "inCorso", opzioni);
    if (inCorso.tipo !== "ok") throw new Error("in corso non applicato");
    expect(statoDi(inCorso.progetto, "B")).toBe("inCorso");

    const fatta = cambiaStato(base, id(base, "B"), "fatta", opzioni);
    if (fatta.tipo !== "ok") throw new Error("fatta non applicata");
    expect(statoDi(fatta.progetto, "B")).toBe("fatta");

    const tutteFatte = conStato(base, "fatta", "A", "B");
    const riaperta = riapri(tutteFatte, id(base, "A"), opzioni);
    if (riaperta.tipo !== "ok") throw new Error("riapertura non applicata");
    expect(statoDi(riaperta.progetto, "A")).toBe("inCorso");
  });

  it("nessuna conferma quando le dipendenze sono fatte o le dipendenti non lo sono", () => {
    const base = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);
    const conAFatta = conStato(base, "fatta", "A");

    expect(bloccata(conAFatta, id(base, "B"))).toBe(false);
    expect(cambiaStato(conAFatta, id(base, "B"), "inCorso").tipo).toBe("ok");
    expect(cambiaStato(conAFatta, id(base, "B"), "fatta").tipo).toBe("ok");
    expect(riapri(conAFatta, id(base, "A")).tipo).toBe("ok");
  });
});

// Imposta la priorità scelta delle task indicate.
function conPriorita(progetto: Progetto, priorita: Priorita, ...nomi: string[]): Progetto {
  return nomi.reduce((p, nome) => {
    const esito = modificaTask(p, id(p, nome), { priorita });
    if (esito.tipo !== "ok") throw new Error(`priorità di ${nome} non cambiata`);
    return esito.progetto;
  }, progetto);
}

const effettiva = (progetto: Progetto, titolo: string) => prioritaEffettive(progetto).get(id(progetto, titolo))!;

// Le task nascono a «ora»; un giorno sono 24 ore.
const dopoGiorni = (giorni: number) => new Date(ora.getTime() + giorni * 24 * 60 * 60 * 1000);

describe("priorità effettiva: presto alta", () => {
  it("una presto alta ancora da fare diventa alta al giorno N, non prima", () => {
    const progetto = conPriorita(progettoConTask("A"), "prestoAlta", "A");

    const alNonoGiorno = applicaPrestoAlta(progetto, dopoGiorni(9), 10);
    expect(effettiva(alNonoGiorno, "A")).toEqual({ priorita: "prestoAlta", motivi: [] });

    const alDecimoGiorno = applicaPrestoAlta(progetto, dopoGiorni(10), 10);
    expect(effettiva(alDecimoGiorno, "A")).toEqual({
      priorita: "alta",
      motivi: [{ tipo: "prestoAltaScaduta", il: dopoGiorni(10).toISOString() }],
    });
  });

  it("il passaggio ad alta è definitivo: resta alta anche messa in corso e con i giorni cambiati", () => {
    const scaduta = applicaPrestoAlta(conPriorita(progettoConTask("A"), "prestoAlta", "A"), dopoGiorni(10), 10);
    const inCorso = conStato(scaduta, "inCorso", "A");

    const dopo = applicaPrestoAlta(inCorso, dopoGiorni(11), 30);

    expect(effettiva(dopo, "A").priorita).toBe("alta");
  });

  it("una presto alta già in corso al giorno N non scatta", () => {
    const progetto = conStato(conPriorita(progettoConTask("A"), "prestoAlta", "A"), "inCorso", "A");

    expect(effettiva(applicaPrestoAlta(progetto, dopoGiorni(20), 10), "A")).toEqual({ priorita: "prestoAlta", motivi: [] });
  });

  it("scegliere un'altra priorità annulla lo scatto: vale la nuova scelta", () => {
    const scaduta = applicaPrestoAlta(conPriorita(progettoConTask("A"), "prestoAlta", "A"), dopoGiorni(10), 10);

    expect(effettiva(conPriorita(scaduta, "bassa", "A"), "A")).toEqual({ priorita: "bassa", motivi: [] });
  });
});

describe("priorità effettiva: task bloccante", () => {
  it("una bloccante sale di un livello sopra la più alta delle task che blocca", () => {
    const base = conDipendenze(progettoConTask("A", "Media", "PrestoAlta"), ["A", "Media"], ["A", "PrestoAlta"]);
    const progetto = conPriorita(conPriorita(base, "bassa", "A"), "prestoAlta", "PrestoAlta");

    const a = effettiva(progetto, "A");

    expect(a.priorita).toBe("alta");
    expect(a.motivi).toEqual([{ tipo: "blocca", task: [progetto.task[2]] }]);
  });

  it("bloccare una media porta a presto alta, non oltre", () => {
    const progetto = conPriorita(conDipendenze(progettoConTask("A", "B"), ["A", "B"]), "bassa", "A");

    expect(effettiva(progetto, "A").priorita).toBe("prestoAlta");
  });

  it("bloccare un'alta porta ad alta, il massimo", () => {
    const progetto = conPriorita(conDipendenze(progettoConTask("A", "B"), ["A", "B"]), "alta", "B");

    expect(effettiva(progetto, "A")).toEqual({ priorita: "alta", motivi: [{ tipo: "blocca", task: [progetto.task[1]] }] });
  });

  it("una bloccante già più alta delle task che blocca resta alla sua scelta", () => {
    const base = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);
    const progetto = conPriorita(conPriorita(base, "alta", "A"), "bassa", "B");

    expect(effettiva(progetto, "A")).toEqual({ priorita: "alta", motivi: [] });
  });

  it("vale a catena: A → B → task alta rende alte A e B", () => {
    const base = conDipendenze(progettoConTask("A", "B", "Urgente"), ["A", "B"], ["B", "Urgente"]);
    const progetto = conPriorita(conPriorita(base, "bassa", "A", "B"), "alta", "Urgente");

    expect(effettiva(progetto, "B")).toEqual({ priorita: "alta", motivi: [{ tipo: "blocca", task: [progetto.task[2]] }] });
    expect(effettiva(progetto, "A")).toEqual({ priorita: "alta", motivi: [{ tipo: "blocca", task: [progetto.task[1]] }] });
  });

  it("la catena sale di un livello a ogni passo", () => {
    const base = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["B", "C"]);
    const progetto = conPriorita(base, "bassa", "A", "B", "C");

    expect([effettiva(progetto, "C"), effettiva(progetto, "B"), effettiva(progetto, "A")].map((e) => e.priorita)).toEqual([
      "bassa",
      "media",
      "prestoAlta",
    ]);
  });

  it("una presto alta scaduta vale come alta per le sue bloccanti", () => {
    const base = conPriorita(conDipendenze(progettoConTask("A", "B"), ["A", "B"]), "prestoAlta", "B");
    const progetto = applicaPrestoAlta(conPriorita(base, "bassa", "A"), dopoGiorni(10), 10);

    expect(effettiva(progetto, "A").priorita).toBe("alta");
  });

  it("le task fatte non contano: chiuse le bloccate, la priorità torna alla scelta", () => {
    const base = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"], ["A", "C"]);
    const progetto = conPriorita(conPriorita(base, "bassa", "A", "C"), "alta", "B");

    const conBFatta = conStato(progetto, "fatta", "B");
    expect(effettiva(conBFatta, "A").priorita).toBe("media");

    expect(effettiva(conStato(conBFatta, "fatta", "C"), "A")).toEqual({ priorita: "bassa", motivi: [] });
  });
});

type Riquadro = { x: number; y: number };

// Due task si sovrappongono se i loro ingombri si toccano in orizzontale e in verticale.
const siSovrappongono = (a: Riquadro, b: Riquadro) =>
  Math.abs(a.x - b.x) < INGOMBRO_TASK.larghezza && Math.abs(a.y - b.y) < INGOMBRO_TASK.altezza;

function sovrapposte(progetto: Progetto): string[] {
  const coppie: string[] = [];
  progetto.task.forEach((a, i) =>
    progetto.task.slice(i + 1).forEach((b) => {
      if (siSovrappongono(a.posizione, b.posizione)) coppie.push(`${a.titolo} / ${b.titolo}`);
    }),
  );
  return coppie;
}

const x = (progetto: Progetto, titolo: string) => progetto.task.find((t) => t.titolo === titolo)!.posizione.x;

describe("«Riordina»", () => {
  it("mette ogni task bloccante a sinistra delle task che blocca, anche a catena", () => {
    const progetto = conDipendenze(progettoConTask("C", "B", "A", "D"), ["A", "B"], ["B", "C"], ["D", "C"]);

    const riordinato = riordina(progetto);

    expect(x(riordinato, "A")).toBeLessThan(x(riordinato, "B"));
    expect(x(riordinato, "B")).toBeLessThan(x(riordinato, "C"));
    expect(x(riordinato, "D")).toBeLessThan(x(riordinato, "C"));
  });

  it("nessuna task si sovrappone a un'altra", () => {
    const base = progettoConTask("A", "B", "C", "D", "E", "F", "G");
    const progetto = conDipendenze(base, ["A", "C"], ["B", "C"], ["C", "D"], ["A", "E"]);
    // Tutte ammucchiate nello stesso punto prima di riordinare.
    const ammucchiato = { ...progetto, task: progetto.task.map((t) => ({ ...t, posizione: { x: 0, y: 0 } })) };

    expect(sovrapposte(riordina(ammucchiato))).toEqual([]);
  });

  it("dà la stessa disposizione qualunque fossero le posizioni di prima", () => {
    const progetto = conDipendenze(progettoConTask("A", "B", "C", "D"), ["A", "B"], ["A", "C"]);
    const spostato = { ...progetto, task: progetto.task.map((t, i) => ({ ...t, posizione: { x: 500 - i * 70, y: i * 33 } })) };

    const posizioni = (p: Progetto) => p.task.map((t) => t.posizione);
    expect(posizioni(riordina(spostato))).toEqual(posizioni(riordina(progetto)));
  });

  it("non tocca nient'altro che le posizioni", () => {
    const progetto = conDipendenze(progettoConTask("A", "B"), ["A", "B"]);

    const riordinato = riordina(progetto);

    const senzaPosizioni = (p: Progetto) => ({ ...p, task: p.task.map(({ posizione: _, ...resto }) => resto) });
    expect(senzaPosizioni(riordinato)).toEqual(senzaPosizioni(progetto));
  });
});

describe("task nuova senza posizione", () => {
  it("si piazza senza sovrapporsi alle task esistenti", () => {
    const base = progettoConTask("A", "B", "C");
    // Task sparse, due quasi sovrapposte, una sotto a destra.
    const posizioni = [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 600, y: 400 }];
    const progetto = { ...base, task: base.task.map((t, i) => ({ ...t, posizione: posizioni[i] })) };

    const esito = creaTask(progetto, { titolo: "Nuova" }, ora);

    if (esito.tipo !== "ok") throw new Error("task non creata");
    const nuova = esito.progetto.task.find((t) => t.titolo === "Nuova")!;
    expect(Number.isFinite(nuova.posizione.x) && Number.isFinite(nuova.posizione.y)).toBe(true);
    expect(sovrapposte(esito.progetto)).toEqual(["A / B"]);
  });

  it("in un progetto vuoto nasce nell'origine", () => {
    const creato = creaProgetto("Casa", ora);
    if (creato.tipo !== "ok") throw new Error("progetto non creato");

    const esito = creaTask(creato.progetto, { titolo: "Prima" }, ora);

    if (esito.tipo !== "ok") throw new Error("task non creata");
    expect(esito.progetto.task[0].posizione).toEqual({ x: 0, y: 0 });
  });
});

describe("filtri", () => {
  it("il filtro per priorità guarda la priorità effettiva, non quella scelta", () => {
    // A è bassa ma blocca un'alta: la sua effettiva è alta.
    const base = conDipendenze(progettoConTask("A", "B", "C"), ["A", "B"]);
    const progetto = conPriorita(conPriorita(base, "bassa", "A", "C"), "alta", "B");
    const filtri = { ...FILTRI_INIZIALI, priorita: ["alta"] as Priorita[] };

    expect(titoli(taskVisibili(progetto, prioritaEffettive(progetto), filtri))).toEqual(["A", "B"]);
  });
});

const visibili = (progetto: Progetto, filtri: Partial<Filtri>) =>
  titoli(taskVisibili(progetto, prioritaEffettive(progetto), { ...FILTRI_INIZIALI, ...filtri }));

describe("filtri: stato e «Nascondi fatte»", () => {
  it("con i filtri iniziali le task fatte sono nascoste; spegnendo «Nascondi fatte» tornano", () => {
    const progetto = conStato(conStato(progettoConTask("A", "B", "C"), "fatta", "A"), "inCorso", "B");

    expect(visibili(progetto, {})).toEqual(["B", "C"]);
    expect(visibili(progetto, { nascondiFatte: false })).toEqual(["A", "B", "C"]);
  });

  it("il filtro per stato tiene solo gli stati scelti", () => {
    const progetto = conStato(conStato(progettoConTask("A", "B", "C"), "fatta", "A"), "inCorso", "B");

    expect(visibili(progetto, { stato: ["inCorso"] })).toEqual(["B"]);
    expect(visibili(progetto, { stato: ["fatta", "daFare"], nascondiFatte: false })).toEqual(["A", "C"]);
  });
});

describe("filtri: costi e combinazioni", () => {
  it("dentro un gruppo basta uno dei valori scelti, tra gruppi diversi servono tutti", () => {
    const progetto = conAttributi(progettoConTask("A", "B", "C", "D"), {
      A: { costoFocus: "neve", costoTempo: "meno1h" },
      B: { costoFocus: "fuoco", costoTempo: "meno1h" },
      C: { costoFocus: "neve", costoTempo: "oltre8h" },
      D: { costoFocus: "termometroRosso", costoTempo: "meno1h" },
    });

    expect(visibili(progetto, { costoFocus: ["neve", "fuoco"] })).toEqual(["A", "B", "C"]);
    expect(visibili(progetto, { costoTempo: ["oltre8h"] })).toEqual(["C"]);
    expect(visibili(progetto, { costoFocus: ["neve", "fuoco"], costoTempo: ["meno1h"] })).toEqual(["A", "B"]);
  });
});

function conAttributi(progetto: Progetto, perTitolo: Record<string, Partial<AttributiTask>>): Progetto {
  return Object.entries(perTitolo).reduce((p, [nome, modifiche]) => {
    const esito = modificaTask(p, id(p, nome), modifiche);
    if (esito.tipo !== "ok") throw new Error(`${nome} non modificata`);
    return esito.progetto;
  }, progetto);
}

describe("focus su una task", () => {
  it("contiene la task, le task da cui dipende e le task che blocca, solo dirette", () => {
    // Prima → Bloccante → Centro → Dipendente → Ultima; Altra è scollegata.
    const progetto = conDipendenze(
      progettoConTask("Prima", "Bloccante", "Centro", "Dipendente", "Ultima", "Altra"),
      ["Prima", "Bloccante"],
      ["Bloccante", "Centro"],
      ["Centro", "Dipendente"],
      ["Dipendente", "Ultima"],
    );

    expect(titoli(taskInFocus(progetto, id(progetto, "Centro")))).toEqual(["Bloccante", "Centro", "Dipendente"]);
  });

  it("mostra anche le task fatte collegate: il focus non guarda i filtri", () => {
    const progetto = conStato(conDipendenze(progettoConTask("A", "B"), ["A", "B"]), "fatta", "A");

    expect(titoli(taskInFocus(progetto, id(progetto, "B")))).toEqual(["A", "B"]);
  });
});

// Catena di verifica della task «Imbiancare» di progettoConDueTask: rischio «Muffa» con i test «Igrometro» e «Spugna».
function conCatena(): { progetto: Progetto; taskId: string; rischioId: string; igrometro: string; spugna: string } {
  const base = progettoConDueTask();
  const taskId = base.task[0].id;
  const rischio = aggiungiRischio(base, taskId, { titolo: "Muffa", descrizione: "Pareti umide" });
  if (rischio.tipo !== "ok") throw new Error("rischio non aggiunto");
  const rischioId = rischiDi(rischio.progetto, taskId)[0].id;
  const primo = aggiungiTest(rischio.progetto, taskId, rischioId, { titolo: "Igrometro" });
  if (primo.tipo !== "ok") throw new Error("test non aggiunto");
  const secondo = aggiungiTest(primo.progetto, taskId, rischioId, { titolo: "Spugna" });
  if (secondo.tipo !== "ok") throw new Error("test non aggiunto");
  const [igrometro, spugna] = rischiDi(secondo.progetto, taskId)[0].test.map((t) => t.id);
  return { progetto: secondo.progetto, taskId, rischioId, igrometro, spugna };
}

const rischiDi = (progetto: Progetto, taskId: string) => progetto.task.find((t) => t.id === taskId)!.rischi;
const testDi = (progetto: Progetto, taskId: string, testId: string) =>
  rischiDi(progetto, taskId)
    .flatMap((r) => r.test)
    .find((t) => t.id === testId)!;

function ok(esito: Esito): Progetto {
  if (esito.tipo !== "ok") throw new Error(`rifiutato: ${esito.motivo}`);
  return esito.progetto;
}

describe("catena di verifica: struttura", () => {
  it("una task nuova non ha rischi", () => {
    expect(progettoConDueTask().task[0].rischi).toEqual([]);
  });

  it("aggiunge un rischio con titolo e descrizione e più test, tutti da provare e senza piano B", () => {
    const { progetto, taskId } = conCatena();

    const [rischio] = rischiDi(progetto, taskId);
    expect(rischio).toMatchObject({ titolo: "Muffa", descrizione: "Pareti umide" });
    expect(rischio.test.map((t) => [t.titolo, t.esito, t.pianoB])).toEqual([
      ["Igrometro", "daProvare", undefined],
      ["Spugna", "daProvare", undefined],
    ]);
    // Le altre task non hanno la catena.
    expect(progetto.task[1].rischi).toEqual([]);
  });

  it("rifiuta rischi e test senza titolo", () => {
    const { progetto, taskId, rischioId } = conCatena();

    expect(aggiungiRischio(progetto, taskId, { titolo: "  " }).tipo).toBe("rifiutato");
    expect(aggiungiTest(progetto, taskId, rischioId, { titolo: "" }).tipo).toBe("rifiutato");
  });

  it("modifica il titolo e la descrizione di un rischio e il titolo di un test", () => {
    const { progetto, taskId, rischioId, igrometro } = conCatena();

    const modificato = ok(
      modificaTest(ok(modificaRischio(progetto, taskId, rischioId, { titolo: " Condensa ", descrizione: "" })), taskId, igrometro, {
        titolo: "Igrometro digitale",
      }),
    );

    expect(rischiDi(modificato, taskId)[0]).toMatchObject({ titolo: "Condensa", descrizione: "" });
    expect(testDi(modificato, taskId, igrometro).titolo).toBe("Igrometro digitale");
  });

  it("eliminando un rischio spariscono anche i suoi test", () => {
    const { progetto, taskId, rischioId } = conCatena();

    expect(rischiDi(ok(eliminaRischio(progetto, taskId, rischioId)), taskId)).toEqual([]);
  });

  it("i nodi nuovi della catena non si sovrappongono", () => {
    const { progetto, taskId } = conCatena();
    const secondoRischio = ok(aggiungiRischio(progetto, taskId, { titolo: "Colore sbagliato" }));
    const conTest = ok(aggiungiTest(secondoRischio, taskId, rischiDi(secondoRischio, taskId)[1].id, { titolo: "Campione" }));
    const conAzione = ok(
      impostaPianoB(conTest, taskId, rischiDi(conTest, taskId)[0].test[1].id, { tipo: "azione", testo: "Deumidificatore" }),
    );

    const posizioni = rischiDi(conAzione, taskId).flatMap((r) => [
      r.posizione,
      ...r.test.flatMap((t) => [t.posizione, ...(t.pianoB?.tipo === "azione" ? [t.pianoB.posizione] : [])]),
    ]);
    const chiavi = posizioni.map((p) => `${p.x},${p.y}`);
    expect(new Set(chiavi).size).toBe(chiavi.length);
  });

  it("sposta i nodi della catena, anche su una task fatta", () => {
    const { progetto, taskId, rischioId, igrometro } = conCatena();
    const fatta = conStato(progetto, "fatta", "Imbiancare");

    const spostato = ok(spostaNodoCatena(fatta, taskId, { tipo: "test", id: igrometro }, { x: 7, y: 8 }));
    expect(testDi(spostato, taskId, igrometro).posizione).toEqual({ x: 7, y: 8 });
    const rischio = ok(spostaNodoCatena(spostato, taskId, { tipo: "rischio", id: rischioId }, { x: -3, y: 4 }));
    expect(rischiDi(rischio, taskId)[0].posizione).toEqual({ x: -3, y: 4 });
  });

  it("una task fatta ha la catena in sola lettura", () => {
    const { progetto, taskId, igrometro } = conCatena();
    const fatta = conStato(progetto, "fatta", "Imbiancare");

    expect(aggiungiRischio(fatta, taskId, { titolo: "Altro" }).tipo).toBe("rifiutato");
    expect(impostaEsito(fatta, taskId, igrometro, "passato").tipo).toBe("rifiutato");
  });

  it("completa con una catena vuota le task salvate prima dei rischi", () => {
    const salvato = {
      id: "p1",
      nome: "Casa",
      creatoIl: "2026-11-01T10:00:00.000Z",
      task: [{ id: "t1", titolo: "Vecchia", posizione: { x: 5, y: 6 }, creataIl: "2026-11-01T10:00:00.000Z" }],
      dipendenze: [],
    };

    expect(ripristinaProgetto(salvato as unknown as Progetto).task[0].rischi).toEqual([]);
  });
});

describe("catena di verifica: task atomica", () => {
  it("una task atomica non accetta rischi", () => {
    const progetto = progettoConDueTask();
    const atomica = ok(modificaTask(progetto, progetto.task[0].id, { atomica: true }));

    expect(aggiungiRischio(atomica, progetto.task[0].id, { titolo: "Muffa" }).tipo).toBe("rifiutato");
  });

  it("una task con rischi non diventa atomica e li conserva", () => {
    const { progetto, taskId } = conCatena();

    expect(modificaTask(progetto, taskId, { atomica: true }).tipo).toBe("rifiutato");
    // Il resto della modifica passa: la catena resta e la task non è atomica.
    const altro = ok(modificaTask(progetto, taskId, { costoTempo: "meno1h" }));
    expect(altro.task[0]).toMatchObject({ atomica: false, costoTempo: "meno1h" });
    expect(rischiDi(altro, taskId)).toHaveLength(1);
  });
});

describe("catena di verifica: esiti", () => {
  it("segna un test passato o fallito e lo riporta da provare", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();

    const passato = ok(impostaEsito(progetto, taskId, igrometro, "passato"));
    const fallito = ok(impostaEsito(passato, taskId, spugna, "fallito"));
    expect(testDi(fallito, taskId, igrometro).esito).toBe("passato");
    expect(testDi(fallito, taskId, spugna).esito).toBe("fallito");
    expect(testDi(ok(impostaEsito(fallito, taskId, spugna, "daProvare")), taskId, spugna).esito).toBe("daProvare");
  });

  it("la task ha rischi aperti finché un suo rischio ha test non passati o nessun test", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();
    const task = (p: Progetto) => p.task.find((t) => t.id === taskId)!;

    expect(haRischiAperti(task(progetto))).toBe(true);
    const unoPassato = ok(impostaEsito(progetto, taskId, igrometro, "passato"));
    expect(haRischiAperti(task(unoPassato))).toBe(true);
    const tuttiPassati = ok(impostaEsito(unoPassato, taskId, spugna, "passato"));
    expect(haRischiAperti(task(tuttiPassati))).toBe(false);
    // Un rischio senza test non è verificato.
    expect(haRischiAperti(task(ok(aggiungiRischio(tuttiPassati, taskId, { titolo: "Colore" }))))).toBe(true);
    expect(haRischiAperti(progettoConDueTask().task[0])).toBe(false);
  });

  it("il piano B di un test fallito è da eseguire, quello di un test passato o da provare no", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();
    const conPiani = ok(
      impostaPianoB(ok(impostaPianoB(progetto, taskId, igrometro, { tipo: "test", testId: spugna })), taskId, spugna, {
        tipo: "azione",
        testo: "Deumidificatore",
      }),
    );
    const task = (p: Progetto) => p.task.find((t) => t.id === taskId)!;

    expect(pianiBDaEseguire(task(conPiani))).toEqual([]);
    const fallito = ok(impostaEsito(conPiani, taskId, igrometro, "fallito"));
    expect(pianiBDaEseguire(task(fallito))).toEqual([{ testId: igrometro, bersaglio: { tipo: "test", id: spugna } }]);
    const entrambi = ok(impostaEsito(fallito, taskId, spugna, "fallito"));
    expect(pianiBDaEseguire(task(entrambi))).toEqual([
      { testId: igrometro, bersaglio: { tipo: "test", id: spugna } },
      { testId: spugna, bersaglio: { tipo: "azione", id: spugna } },
    ]);
    expect(pianiBDaEseguire(task(ok(impostaEsito(entrambi, taskId, igrometro, "passato"))))).toEqual([
      { testId: spugna, bersaglio: { tipo: "azione", id: spugna } },
    ]);
  });
});

describe("catena di verifica: piano B", () => {
  it("il piano B di tipo test punta a un altro test dello stesso rischio", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();

    const conPiano = ok(impostaPianoB(progetto, taskId, igrometro, { tipo: "test", testId: spugna }));
    expect(testDi(conPiano, taskId, igrometro).pianoB).toEqual({ tipo: "test", testId: spugna });
  });

  it("rifiuta un piano B di tipo test verso un test di un altro rischio, verso sé stesso o inesistente", () => {
    const { progetto, taskId, igrometro } = conCatena();
    const altroRischio = ok(aggiungiRischio(progetto, taskId, { titolo: "Colore" }));
    const conAltroTest = ok(aggiungiTest(altroRischio, taskId, rischiDi(altroRischio, taskId)[1].id, { titolo: "Campione" }));
    const campione = rischiDi(conAltroTest, taskId)[1].test[0].id;

    expect(impostaPianoB(conAltroTest, taskId, igrometro, { tipo: "test", testId: campione }).tipo).toBe("rifiutato");
    expect(impostaPianoB(conAltroTest, taskId, igrometro, { tipo: "test", testId: igrometro }).tipo).toBe("rifiutato");
    expect(impostaPianoB(conAltroTest, taskId, igrometro, { tipo: "test", testId: "inesistente" }).tipo).toBe("rifiutato");
  });

  it("il piano B di tipo azione è un testo non vuoto e cambiandolo resta dov'era", () => {
    const { progetto, taskId, igrometro } = conCatena();

    expect(impostaPianoB(progetto, taskId, igrometro, { tipo: "azione", testo: "  " }).tipo).toBe("rifiutato");
    const conAzione = ok(impostaPianoB(progetto, taskId, igrometro, { tipo: "azione", testo: " Deumidificatore " }));
    const spostata = ok(spostaNodoCatena(conAzione, taskId, { tipo: "azione", id: igrometro }, { x: 50, y: 60 }));
    const rinominata = ok(impostaPianoB(spostata, taskId, igrometro, { tipo: "azione", testo: "Pittura antimuffa" }));

    expect(testDi(rinominata, taskId, igrometro).pianoB).toEqual({
      tipo: "azione",
      testo: "Pittura antimuffa",
      posizione: { x: 50, y: 60 },
    });
  });

  it("ogni test ha un solo piano B: il nuovo sostituisce il vecchio, e si può togliere", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();
    const conAzione = ok(impostaPianoB(progetto, taskId, igrometro, { tipo: "azione", testo: "Deumidificatore" }));

    const conTest = ok(impostaPianoB(conAzione, taskId, igrometro, { tipo: "test", testId: spugna }));
    expect(testDi(conTest, taskId, igrometro).pianoB).toEqual({ tipo: "test", testId: spugna });
    expect(testDi(ok(rimuoviPianoB(conTest, taskId, igrometro)), taskId, igrometro).pianoB).toBeUndefined();
  });

  it("eliminando un test sparisce anche il piano B degli altri test che puntava a lui", () => {
    const { progetto, taskId, igrometro, spugna } = conCatena();
    const conPiano = ok(impostaPianoB(progetto, taskId, igrometro, { tipo: "test", testId: spugna }));

    const senzaSpugna = ok(eliminaTest(conPiano, taskId, spugna));
    expect(rischiDi(senzaSpugna, taskId)[0].test.map((t) => t.titolo)).toEqual(["Igrometro"]);
    expect(testDi(senzaSpugna, taskId, igrometro).pianoB).toBeUndefined();
  });
});
