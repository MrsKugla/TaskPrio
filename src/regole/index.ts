// Modulo regole: TypeScript puro, senza React né Tauri.
// La data corrente arriva sempre da fuori, così le regole restano deterministiche.

export type Posizione = { x: number; y: number };

// Ordini dal più alto al più basso: l'interfaccia li mostra in questo ordine.
export const PRIORITA = ["alta", "prestoAlta", "media", "bassa"] as const;
export type Priorita = (typeof PRIORITA)[number];

export const COSTI_FOCUS = ["neve", "termometroBlu", "termometroRosso", "fuoco"] as const;
export type CostoFocus = (typeof COSTI_FOCUS)[number];

export const COSTI_TEMPO = ["meno1h", "da1a4h", "da4a8h", "oltre8h"] as const;
export type CostoTempo = (typeof COSTI_TEMPO)[number];

export type AttributiTask = {
  titolo: string;
  descrizione: string;
  priorita: Priorita;
  costoFocus: CostoFocus;
  costoTempo: CostoTempo;
  atomica: boolean;
};

export type Task = AttributiTask & {
  id: string;
  posizione: Posizione;
  creataIl: string;
};

export type Progetto = {
  id: string;
  nome: string;
  creatoIl: string;
  task: Task[];
};

export type Esito = { tipo: "ok"; progetto: Progetto } | { tipo: "rifiutato"; motivo: string };

const ATTRIBUTI_INIZIALI: Omit<AttributiTask, "titolo"> = {
  descrizione: "",
  priorita: "media",
  costoFocus: "termometroBlu",
  costoTempo: "da1a4h",
  atomica: false,
};

function rifiutato(motivo: string): Esito {
  return { tipo: "rifiutato", motivo };
}

export function creaProgetto(nome: string, ora: Date): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome del progetto non può essere vuoto.");
  return { tipo: "ok", progetto: { id: crypto.randomUUID(), nome: pulito, creatoIl: ora.toISOString(), task: [] } };
}

export function rinominaProgetto(progetto: Progetto, nome: string): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome del progetto non può essere vuoto.");
  return { tipo: "ok", progetto: { ...progetto, nome: pulito } };
}

// Progetti salvati da versioni precedenti: completa gli attributi mancanti con i valori iniziali.
export function ripristinaProgetto(salvato: Progetto): Progetto {
  return { ...salvato, task: salvato.task.map((t) => ({ ...ATTRIBUTI_INIZIALI, ...t })) };
}

export function creaTask(progetto: Progetto, dati: { titolo: string; posizione: Posizione }, ora: Date): Esito {
  const titolo = dati.titolo.trim();
  if (!titolo) return rifiutato("Il titolo della task non può essere vuoto.");
  const task: Task = {
    id: crypto.randomUUID(),
    titolo,
    ...ATTRIBUTI_INIZIALI,
    posizione: { ...dati.posizione },
    creataIl: ora.toISOString(),
  };
  return { tipo: "ok", progetto: { ...progetto, task: [...progetto.task, task] } };
}

// Una task atomica si fa in un solo passaggio: oltre le 4h sarebbe un controsenso.
export function puoEssereAtomica(costoTempo: CostoTempo): boolean {
  return costoTempo === "meno1h" || costoTempo === "da1a4h";
}

export function modificaTask(progetto: Progetto, taskId: string, modifiche: Partial<AttributiTask>): Esito {
  const attuale = progetto.task.find((t) => t.id === taskId);
  if (!attuale) return rifiutato("La task non esiste più.");
  const aggiornata: Task = { ...attuale, ...modifiche };
  if (modifiche.titolo !== undefined) {
    aggiornata.titolo = modifiche.titolo.trim();
    if (!aggiornata.titolo) return rifiutato("Il titolo della task non può essere vuoto.");
  }
  if (!puoEssereAtomica(aggiornata.costoTempo)) {
    if (modifiche.atomica) return rifiutato("Una task oltre le 4h non può essere atomica.");
    aggiornata.atomica = false;
  }
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.map((t) => (t.id === taskId ? aggiornata : t)) } };
}

export function eliminaTask(progetto: Progetto, taskId: string): Esito {
  if (!progetto.task.some((t) => t.id === taskId)) return rifiutato("La task non esiste più.");
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.filter((t) => t.id !== taskId) } };
}
