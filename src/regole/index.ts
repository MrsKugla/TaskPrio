// Modulo regole: TypeScript puro, senza React né Tauri.
// La data corrente arriva sempre da fuori, così le regole restano deterministiche.

export type Posizione = { x: number; y: number };

export type Task = {
  id: string;
  titolo: string;
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

export function creaTask(progetto: Progetto, dati: { titolo: string; posizione: Posizione }, ora: Date): Esito {
  const titolo = dati.titolo.trim();
  if (!titolo) return rifiutato("Il titolo della task non può essere vuoto.");
  const task: Task = { id: crypto.randomUUID(), titolo, posizione: { ...dati.posizione }, creataIl: ora.toISOString() };
  return { tipo: "ok", progetto: { ...progetto, task: [...progetto.task, task] } };
}
