import { describe, expect, it } from "vitest";
import { creaProgetto, creaTask, eliminaTask, modificaTask, rinominaProgetto, ripristinaProgetto, type Progetto } from "./index";

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
