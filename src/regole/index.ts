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

// Stato scelto a mano. Una task fatta è in sola lettura finché non si riapre.
export const STATI = ["daFare", "inCorso", "fatta"] as const;
export type Stato = (typeof STATI)[number];

export type Task = AttributiTask & {
  id: string;
  posizione: Posizione;
  creataIl: string;
  stato: Stato;
  // Data in cui la presto alta è scaduta: da lì la task resta alta, anche se poi va in corso.
  prestoAltaScadutaIl?: string;
};

// La task «dipendenteId» non può partire prima che «bloccanteId» sia fatta.
export type Dipendenza = { bloccanteId: string; dipendenteId: string };

export type Progetto = {
  id: string;
  nome: string;
  creatoIl: string;
  task: Task[];
  dipendenze: Dipendenza[];
};

// «cerchio» elenca, in ordine, le task di una dipendenza rifiutata perché chiuderebbe un cerchio.
export type Esito = { tipo: "ok"; progetto: Progetto } | { tipo: "rifiutato"; motivo: string; cerchio?: Task[] };

// Un cambio di stato che è un controsenso non viene applicato: si ripete con «confermato» dopo il «Sei sicura?».
export type EsitoStato = Esito | { tipo: "richiedeConferma"; controsenso: string };
export type OpzioniStato = { confermato?: boolean };

const VALORI_INIZIALI: Omit<AttributiTask, "titolo"> & { stato: Stato } = {
  descrizione: "",
  priorita: "media",
  costoFocus: "termometroBlu",
  costoTempo: "da1a4h",
  atomica: false,
  stato: "daFare",
};

function rifiutato(motivo: string): Esito {
  return { tipo: "rifiutato", motivo };
}

export function creaProgetto(nome: string, ora: Date): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome del progetto non può essere vuoto.");
  return {
    tipo: "ok",
    progetto: { id: crypto.randomUUID(), nome: pulito, creatoIl: ora.toISOString(), task: [], dipendenze: [] },
  };
}

export function rinominaProgetto(progetto: Progetto, nome: string): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome del progetto non può essere vuoto.");
  return { tipo: "ok", progetto: { ...progetto, nome: pulito } };
}

// Progetti salvati da versioni precedenti: completa i dati mancanti con i valori iniziali.
export function ripristinaProgetto(salvato: Progetto): Progetto {
  return {
    ...salvato,
    task: salvato.task.map((t) => ({ ...VALORI_INIZIALI, ...t })),
    dipendenze: salvato.dipendenze ?? [],
  };
}

export function creaTask(progetto: Progetto, dati: { titolo: string; posizione: Posizione }, ora: Date): Esito {
  const titolo = dati.titolo.trim();
  if (!titolo) return rifiutato("Il titolo della task non può essere vuoto.");
  const task: Task = {
    id: crypto.randomUUID(),
    titolo,
    ...VALORI_INIZIALI,
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
  if (attuale.stato === "fatta") return rifiutato("Una task fatta non si modifica: riaprila prima.");
  const aggiornata: Task = { ...attuale, ...modifiche };
  // Una nuova scelta di priorità annulla lo scatto della presto alta: le regole ripartono dalla scelta.
  if (modifiche.priorita !== undefined && modifiche.priorita !== attuale.priorita) delete aggiornata.prestoAltaScadutaIl;
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
  // Con la task spariscono anche le sue dipendenze, in entrambe le direzioni.
  const dipendenze = progetto.dipendenze.filter((d) => d.bloccanteId !== taskId && d.dipendenteId !== taskId);
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.filter((t) => t.id !== taskId), dipendenze } };
}

// Task da cui dipende la task indicata, nell'ordine del progetto.
export function bloccanti(progetto: Progetto, taskId: string): Task[] {
  const ids = new Set(progetto.dipendenze.filter((d) => d.dipendenteId === taskId).map((d) => d.bloccanteId));
  return progetto.task.filter((t) => ids.has(t.id));
}

// Task che la task indicata blocca, nell'ordine del progetto.
export function dipendenti(progetto: Progetto, taskId: string): Task[] {
  const ids = new Set(progetto.dipendenze.filter((d) => d.bloccanteId === taskId).map((d) => d.dipendenteId));
  return progetto.task.filter((t) => ids.has(t.id));
}

// Percorso più breve da «da» ad «a» seguendo le dipendenze (bloccante → dipendente), o null se non c'è.
function percorso(progetto: Progetto, da: string, a: string): string[] | null {
  const precedente = new Map<string, string | null>([[da, null]]);
  const coda = [da];
  for (let i = 0; i < coda.length; i++) {
    const corrente = coda[i];
    if (corrente === a) {
      const ids: string[] = [];
      for (let id: string | null = a; id !== null; id = precedente.get(id)!) ids.unshift(id);
      return ids;
    }
    for (const d of progetto.dipendenze) {
      if (d.bloccanteId === corrente && !precedente.has(d.dipendenteId)) {
        precedente.set(d.dipendenteId, corrente);
        coda.push(d.dipendenteId);
      }
    }
  }
  return null;
}

export function aggiungiDipendenza(progetto: Progetto, bloccanteId: string, dipendenteId: string): Esito {
  const esiste = (id: string) => progetto.task.some((t) => t.id === id);
  if (!esiste(bloccanteId) || !esiste(dipendenteId)) return rifiutato("Le dipendenze sono solo tra task dello stesso progetto.");
  if (progetto.dipendenze.some((d) => d.bloccanteId === bloccanteId && d.dipendenteId === dipendenteId)) {
    return rifiutato("Questa dipendenza esiste già.");
  }
  // La nuova freccia bloccante → dipendente chiude un cerchio se dal dipendente si arriva già al bloccante.
  const ids = percorso(progetto, dipendenteId, bloccanteId);
  if (ids) {
    const cerchio = ids.map((id) => progetto.task.find((t) => t.id === id)!);
    const elenco = [...cerchio, cerchio[0]].map((t) => t.titolo).join(" → ");
    return { tipo: "rifiutato", motivo: `Questa dipendenza chiuderebbe un cerchio: ${elenco}.`, cerchio };
  }
  return { tipo: "ok", progetto: { ...progetto, dipendenze: [...progetto.dipendenze, { bloccanteId, dipendenteId }] } };
}

export function rimuoviDipendenza(progetto: Progetto, bloccanteId: string, dipendenteId: string): Esito {
  const resto = progetto.dipendenze.filter((d) => d.bloccanteId !== bloccanteId || d.dipendenteId !== dipendenteId);
  if (resto.length === progetto.dipendenze.length) return rifiutato("La dipendenza non esiste più.");
  return { tipo: "ok", progetto: { ...progetto, dipendenze: resto } };
}

// Bloccata è calcolata, non è uno stato: la task dipende da almeno una task non fatta.
export function bloccata(progetto: Progetto, taskId: string): boolean {
  return bloccanti(progetto, taskId).some((t) => t.stato !== "fatta");
}

const elencoTitoli = (task: Task[]) => task.map((t) => `«${t.titolo}»`).join(", ");

function impostaStato(progetto: Progetto, taskId: string, stato: Stato): Esito {
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.map((t) => (t.id === taskId ? { ...t, stato } : t)) } };
}

// Cambia lo stato di una task non fatta. Segnare fatta o mettere in corso una task bloccata chiede conferma.
export function cambiaStato(progetto: Progetto, taskId: string, stato: Stato, opzioni: OpzioniStato = {}): EsitoStato {
  const task = progetto.task.find((t) => t.id === taskId);
  if (!task) return rifiutato("La task non esiste più.");
  if (task.stato === "fatta") return rifiutato("Una task fatta si riapre con «Riapri».");
  const aperte = bloccanti(progetto, taskId).filter((t) => t.stato !== "fatta");
  if (!opzioni.confermato && aperte.length > 0) {
    if (stato === "fatta") {
      return {
        tipo: "richiedeConferma",
        controsenso: `«${task.titolo}» dipende da task non ancora fatte: ${elencoTitoli(aperte)}. Sei sicura di segnarla fatta?`,
      };
    }
    if (stato === "inCorso" && task.stato !== "inCorso") {
      return {
        tipo: "richiedeConferma",
        controsenso: `«${task.titolo}» è bloccata: dipende da task non ancora fatte: ${elencoTitoli(aperte)}. Sei sicura di metterla in corso?`,
      };
    }
  }
  return impostaStato(progetto, taskId, stato);
}

// «Riapri» riporta in corso una task fatta. Se da lei dipendono task già fatte chiede conferma.
export function riapri(progetto: Progetto, taskId: string, opzioni: OpzioniStato = {}): EsitoStato {
  const task = progetto.task.find((t) => t.id === taskId);
  if (!task) return rifiutato("La task non esiste più.");
  if (task.stato !== "fatta") return rifiutato("Si riapre solo una task fatta.");
  const fatte = dipendenti(progetto, taskId).filter((t) => t.stato === "fatta");
  if (!opzioni.confermato && fatte.length > 0) {
    return {
      tipo: "richiedeConferma",
      controsenso: `Da «${task.titolo}» dipendono task già fatte: ${elencoTitoli(fatte)}. Sei sicura di riaprirla?`,
    };
  }
  return impostaStato(progetto, taskId, "inCorso");
}

export const GIORNI_PRESTO_ALTA_PREDEFINITI = 10;
const MS_AL_GIORNO = 24 * 60 * 60 * 1000;

// Una presto alta ancora da fare scade dopo «giorni» giorni dalla creazione e da lì resta alta per sempre.
// Restituisce lo stesso progetto se nessuna task scade, così chi chiama sa se c'è da salvare.
export function applicaPrestoAlta(progetto: Progetto, ora: Date, giorni: number): Progetto {
  let cambiato = false;
  const task = progetto.task.map((t) => {
    if (t.priorita !== "prestoAlta" || t.stato !== "daFare" || t.prestoAltaScadutaIl) return t;
    const scadenza = new Date(new Date(t.creataIl).getTime() + giorni * MS_AL_GIORNO);
    if (ora < scadenza) return t;
    cambiato = true;
    return { ...t, prestoAltaScadutaIl: scadenza.toISOString() };
  });
  return cambiato ? { ...progetto, task } : progetto;
}

// Perché una regola ha alzato la priorità: presto alta scaduta, oppure le task non fatte più alte che la task blocca.
export type MotivoAumento = { tipo: "prestoAltaScaduta"; il: string } | { tipo: "blocca"; task: Task[] };

// «motivi» è vuoto se la priorità effettiva è quella scelta.
export type PrioritaEffettiva = { priorita: Priorita; motivi: MotivoAumento[] };

// PRIORITA va dall'alta alla bassa: un indice più piccolo è una priorità più alta.
const livello = (p: Priorita) => PRIORITA.indexOf(p);

// Priorità effettiva di ogni task, per id: il massimo tra la scelta e le regole, che possono solo alzarla.
// La regola della bloccante parte dalle effettive delle task che blocca: la visita in profondità le calcola prima,
// così vale a catena. Le dipendenze non hanno cerchi, quindi la visita finisce.
export function prioritaEffettive(progetto: Progetto): Map<string, PrioritaEffettiva> {
  const perId = new Map(progetto.task.map((t) => [t.id, t]));
  const risultato = new Map<string, PrioritaEffettiva>();

  const calcola = (t: Task): PrioritaEffettiva => {
    const giaCalcolata = risultato.get(t.id);
    if (giaCalcolata) return giaCalcolata;

    const candidati: { livello: number; motivo: MotivoAumento }[] = [];
    if (t.prestoAltaScadutaIl) candidati.push({ livello: livello("alta"), motivo: { tipo: "prestoAltaScaduta", il: t.prestoAltaScadutaIl } });

    const bloccate = progetto.dipendenze
      .filter((d) => d.bloccanteId === t.id)
      .map((d) => perId.get(d.dipendenteId)!)
      .filter((b) => b.stato !== "fatta")
      .map((b) => ({ task: b, livello: livello(calcola(b).priorita) }));
    if (bloccate.length > 0) {
      const piuAlta = Math.min(...bloccate.map((b) => b.livello));
      candidati.push({
        livello: Math.max(piuAlta - 1, livello("alta")),
        motivo: { tipo: "blocca", task: bloccate.filter((b) => b.livello === piuAlta).map((b) => b.task) },
      });
    }

    const migliore = Math.min(livello(t.priorita), ...candidati.map((c) => c.livello));
    const effettiva: PrioritaEffettiva =
      migliore < livello(t.priorita)
        ? { priorita: PRIORITA[migliore], motivi: candidati.filter((c) => c.livello === migliore).map((c) => c.motivo) }
        : { priorita: t.priorita, motivi: [] };
    risultato.set(t.id, effettiva);
    return effettiva;
  };

  for (const t of progetto.task) calcola(t);
  return risultato;
}
