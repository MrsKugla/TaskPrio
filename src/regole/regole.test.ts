import { describe, expect, it } from "vitest";
import { creaProgetto, creaTask, rinominaProgetto } from "./index";

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
