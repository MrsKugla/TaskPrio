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

// Catena di verifica: la task ha rischi, ogni rischio ha test, ogni test al più un piano B.
export const ESITI = ["daProvare", "passato", "fallito"] as const;
export type EsitoTest = (typeof ESITI)[number];

// Piano B di tipo test: un altro test dello stesso rischio, che nel grafo è già un nodo.
// Di tipo azione: un testo, con un nodo suo nella catena. «taskId» è la task nata con «Crea task»: al più una.
export type PianoB = { tipo: "test"; testId: string } | { tipo: "azione"; testo: string; posizione: Posizione; taskId?: string };

export type Test = { id: string; titolo: string; esito: EsitoTest; posizione: Posizione; pianoB?: PianoB };
export type Rischio = { id: string; titolo: string; descrizione: string; posizione: Posizione; test: Test[] };

export type Task = AttributiTask & {
  id: string;
  posizione: Posizione;
  creataIl: string;
  stato: Stato;
  // Vuoto sulle task atomiche.
  rischi: Rischio[];
  // Data in cui la presto alta è scaduta: da lì la task resta alta, anche se poi va in corso.
  prestoAltaScadutaIl?: string;
  // Sezione del grafo in cui sta la task: al più una.
  sezioneId?: string;
};

// Sezione: un gruppo di task con un nome, disegnato nel grafo come una cornice intorno a loro.
// Non ha posizione né misure sue: la cornice si calcola dalle task che contiene.
export type Sezione = { id: string; nome: string };

// La task «dipendenteId» non può partire prima che «bloccanteId» sia fatta.
export type Dipendenza = { bloccanteId: string; dipendenteId: string };

export type Progetto = {
  id: string;
  nome: string;
  creatoIl: string;
  task: Task[];
  dipendenze: Dipendenza[];
  // Nell'ordine di creazione: è anche l'ordine dall'alto in basso dopo «Riordina».
  sezioni: Sezione[];
};

// «cerchio» elenca, in ordine, le task di una dipendenza rifiutata perché chiuderebbe un cerchio.
export type Esito = { tipo: "ok"; progetto: Progetto } | { tipo: "rifiutato"; motivo: string; cerchio?: Task[] };

// Un cambio di stato che è un controsenso non viene applicato: si ripete con «confermato» dopo il «Sei sicura?».
export type EsitoStato = Esito | { tipo: "richiedeConferma"; controsenso: string };
export type OpzioniStato = { confermato?: boolean };

const VALORI_INIZIALI: Omit<AttributiTask, "titolo"> & Pick<Task, "stato" | "rischi"> = {
  descrizione: "",
  priorita: "media",
  costoFocus: "termometroBlu",
  costoTempo: "da1a4h",
  atomica: false,
  stato: "daFare",
  rischi: [],
};

function rifiutato(motivo: string): Esito {
  return { tipo: "rifiutato", motivo };
}

export function creaProgetto(nome: string, ora: Date): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome del progetto non può essere vuoto.");
  return {
    tipo: "ok",
    progetto: { id: crypto.randomUUID(), nome: pulito, creatoIl: ora.toISOString(), task: [], dipendenze: [], sezioni: [] },
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
    sezioni: salvato.sezioni ?? [],
  };
}

// Spazio che una task occupa nel grafo: lo stile del nodo (app.css, .nodo-task) lo tiene entro 220px e due righe di titolo.
export const INGOMBRO_TASK = { larghezza: 220, altezza: 90 } as const;
const PASSO_COLONNE = INGOMBRO_TASK.larghezza + 80;
const PASSO_RIGHE = INGOMBRO_TASK.altezza + 30;

const siSovrappongono = (a: Posizione, b: Posizione) =>
  Math.abs(a.x - b.x) < INGOMBRO_TASK.larghezza && Math.abs(a.y - b.y) < INGOMBRO_TASK.altezza;

// Primo posto libero su una griglia con i passi di «Riordina», riga per riga dall'angolo in alto a sinistra delle task:
// riempie i buchi prima di allungare il grafo. Sotto l'ultima task c'è sempre posto, quindi la ricerca finisce.
function postoLibero(task: Task[]): Posizione {
  if (task.length === 0) return { x: 0, y: 0 };
  const xs = task.map((t) => t.posizione.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...task.map((t) => t.posizione.y));
  for (let r = 0; ; r++) {
    for (let x = minX; x <= maxX; x += PASSO_COLONNE) {
      const posto = { x, y: minY + r * PASSO_RIGHE };
      if (!task.some((t) => siSovrappongono(t.posizione, posto))) return posto;
    }
  }
}

// Senza posizione (task non creata col doppio clic) la task va nel primo posto libero.
export function creaTask(progetto: Progetto, dati: { titolo: string; posizione?: Posizione }, ora: Date): Esito {
  const titolo = dati.titolo.trim();
  if (!titolo) return rifiutato("Il titolo della task non può essere vuoto.");
  const task: Task = {
    id: crypto.randomUUID(),
    titolo,
    ...VALORI_INIZIALI,
    posizione: { ...(dati.posizione ?? postoLibero(progetto.task)) },
    creataIl: ora.toISOString(),
  };
  return { tipo: "ok", progetto: { ...progetto, task: [...progetto.task, task] } };
}

// Una task atomica si fa in un solo passaggio: oltre le 4h sarebbe un controsenso.
export function puoEssereAtomica(costoTempo: CostoTempo): boolean {
  return costoTempo === "meno1h" || costoTempo === "da1a4h";
}

// Perché la task non può diventare atomica, o undefined se può.
// Diventare atomica cancellerebbe la catena: prima si tolgono i rischi.
export function motivoNonAtomica(task: Task): string | undefined {
  if (task.atomica) return undefined;
  if (!puoEssereAtomica(task.costoTempo)) return "Una task oltre le 4h non può essere atomica";
  if (task.rischi.length > 0) return "Una task con rischi non può essere atomica: elimina prima i rischi";
  return undefined;
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
  if (modifiche.atomica && !attuale.atomica) {
    // Si guarda la task già modificata: costo tempo e atomica possono cambiare insieme.
    const motivo = motivoNonAtomica({ ...aggiornata, atomica: false });
    if (motivo) return rifiutato(`${motivo}.`);
  }
  if (!puoEssereAtomica(aggiornata.costoTempo)) {
    if (modifiche.atomica) return rifiutato("Una task oltre le 4h non può essere atomica.");
    aggiornata.atomica = false;
  }
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.map((t) => (t.id === taskId ? aggiornata : t)) } };
}

export function eliminaTask(progetto: Progetto, taskId: string): Esito {
  if (!progetto.task.some((t) => t.id === taskId)) return rifiutato("La task non esiste più.");
  // Con la task spariscono anche le sue dipendenze, in entrambe le direzioni, e il collegamento dal piano B da cui era nata.
  const dipendenze = progetto.dipendenze.filter((d) => d.bloccanteId !== taskId && d.dipendenteId !== taskId);
  const task = progetto.task.filter((t) => t.id !== taskId).map((t) => scollegaDaPianiB(t, taskId));
  return { tipo: "ok", progetto: senzaSezioniVuote({ ...progetto, task, dipendenze }) };
}

// ---------- Sezioni ----------

// Una sezione senza task non ha più nulla da incorniciare: sparisce.
function senzaSezioniVuote(progetto: Progetto): Progetto {
  const usate = new Set(progetto.task.map((t) => t.sezioneId));
  const sezioni = progetto.sezioni.filter((s) => usate.has(s.id));
  return sezioni.length === progetto.sezioni.length ? progetto : { ...progetto, sezioni };
}

// Raggruppa le task indicate in una sezione nuova. Una task sta in una sola sezione:
// se era già in un'altra ne esce, e la sezione rimasta vuota sparisce.
export function creaSezione(progetto: Progetto, taskIds: string[], nome: string): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome della sezione non può essere vuoto.");
  const ids = new Set(taskIds);
  if (ids.size === 0) return rifiutato("Scegli almeno una task da raggruppare.");
  if ([...ids].some((id) => !progetto.task.some((t) => t.id === id))) return rifiutato("Una delle task non esiste più.");
  const sezione: Sezione = { id: crypto.randomUUID(), nome: pulito };
  const task = progetto.task.map((t) => (ids.has(t.id) ? { ...t, sezioneId: sezione.id } : t));
  return { tipo: "ok", progetto: senzaSezioniVuote({ ...progetto, task, sezioni: [...progetto.sezioni, sezione] }) };
}

export function rinominaSezione(progetto: Progetto, sezioneId: string, nome: string): Esito {
  const pulito = nome.trim();
  if (!pulito) return rifiutato("Il nome della sezione non può essere vuoto.");
  if (!progetto.sezioni.some((s) => s.id === sezioneId)) return rifiutato("La sezione non esiste più.");
  return { tipo: "ok", progetto: { ...progetto, sezioni: progetto.sezioni.map((s) => (s.id === sezioneId ? { ...s, nome: pulito } : s)) } };
}

// Toglie la cornice e il nome: le task restano dove sono, fuori da ogni sezione.
export function eliminaSezione(progetto: Progetto, sezioneId: string): Esito {
  if (!progetto.sezioni.some((s) => s.id === sezioneId)) return rifiutato("La sezione non esiste più.");
  const task = progetto.task.map((t) => {
    if (t.sezioneId !== sezioneId) return t;
    const { sezioneId: _, ...fuori } = t;
    return fuori;
  });
  return { tipo: "ok", progetto: { ...progetto, task, sezioni: progetto.sezioni.filter((s) => s.id !== sezioneId) } };
}

export function taskDellaSezione(progetto: Progetto, sezioneId: string): Task[] {
  return progetto.task.filter((t) => t.sezioneId === sezioneId);
}

// La posizione è disposizione, non contenuto: si cambia anche su una task fatta.
export function spostaTask(progetto: Progetto, taskId: string, posizione: Posizione): Esito {
  if (!progetto.task.some((t) => t.id === taskId)) return rifiutato("La task non esiste più.");
  return {
    tipo: "ok",
    progetto: { ...progetto, task: progetto.task.map((t) => (t.id === taskId ? { ...t, posizione: { ...posizione } } : t)) },
  };
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

// «Riordina»: dispone le task in colonne, ogni bloccante a sinistra delle task che blocca.
// La colonna di una task è la catena più lunga di bloccanti prima di lei; dentro la colonna le task stanno
// vicino alla media delle righe delle loro bloccanti, così le frecce si incrociano poco.
// Ogni sezione ha una fascia di righe sua, una sotto l'altra nell'ordine del progetto, poi le task senza sezione:
// le cornici non si sovrappongono e tra una fascia e l'altra resta una riga vuota per l'etichetta.
// Dipende solo da task, dipendenze e sezioni, non dalle posizioni di prima: riordinare due volte dà lo stesso risultato.
export function riordina(progetto: Progetto): Progetto {
  const colonna = new Map<string, number>();
  const colonnaDi = (taskId: string): number => {
    const nota = colonna.get(taskId);
    if (nota !== undefined) return nota;
    const calcolata = Math.max(-1, ...bloccanti(progetto, taskId).map((b) => colonnaDi(b.id))) + 1;
    colonna.set(taskId, calcolata);
    return calcolata;
  };
  for (const t of progetto.task) colonnaDi(t.id);
  const numeroColonne = Math.max(0, ...colonna.values()) + 1;

  // Fasce: le sezioni esistenti in ordine, poi le task fuori da ogni sezione (o in una sezione che non c'è più).
  const sezioni = new Set(progetto.sezioni.map((s) => s.id));
  const fasciaDi = (t: Task) => (t.sezioneId && sezioni.has(t.sezioneId) ? t.sezioneId : "");
  const fasce = [...progetto.sezioni.map((s) => s.id), ""]
    .map((id) => ({ id, task: progetto.task.filter((t) => fasciaDi(t) === id) }))
    .filter((f) => f.task.length > 0)
    .map((f) => {
      const colonne = Array.from({ length: numeroColonne }, (_, c) => f.task.filter((t) => colonna.get(t.id) === c));
      return { ...f, colonne, righe: Math.max(...colonne.map((c) => c.length)) };
    });
  // Prima riga di ogni fascia; il tutto è centrato in verticale sullo zero, come senza sezioni.
  const inizio: number[] = [];
  let righe = 0;
  for (const f of fasce) {
    inizio.push(righe);
    righe += f.righe + 1;
  }
  const centro = (righe - 2) / 2;

  const posizione = new Map<string, Posizione>();
  for (let c = 0; c < numeroColonne; c++) {
    fasce.forEach((f, i) => {
      const task = f.colonne[c];
      // Le bloccanti stanno nelle colonne precedenti, quindi hanno già la posizione.
      const media = new Map(
        task.map((t) => {
          const altezze = bloccanti(progetto, t.id).map((b) => posizione.get(b.id)!.y);
          return [t.id, altezze.length ? altezze.reduce((a, b) => a + b, 0) / altezze.length : 0];
        }),
      );
      // sort è stabile: a parità di media resta l'ordine del progetto.
      const ordinate = [...task].sort((a, b) => media.get(a.id)! - media.get(b.id)!);
      ordinate.forEach((t, r) => {
        // Ogni colonna è centrata nella sua fascia.
        const riga = inizio[i] + (f.righe - ordinate.length) / 2 + r;
        posizione.set(t.id, { x: c * PASSO_COLONNE, y: (riga - centro) * PASSO_RIGHE });
      });
    });
  }

  return { ...progetto, task: progetto.task.map((t) => ({ ...t, posizione: posizione.get(t.id)! })) };
}

// Filtri del grafo. Un gruppo vuoto non filtra; dentro un gruppo basta un valore, tra i gruppi servono tutti.
export type Filtri = {
  priorita: Priorita[];
  costoFocus: CostoFocus[];
  costoTempo: CostoTempo[];
  stato: Stato[];
  nascondiFatte: boolean;
};

// Al primo avvio non c'è alcun filtro, a parte «Nascondi fatte».
export const FILTRI_INIZIALI: Filtri = { priorita: [], costoFocus: [], costoTempo: [], stato: [], nascondiFatte: true };

const ammesso = <T>(scelti: T[], valore: T) => scelti.length === 0 || scelti.includes(valore);

// Task che passano i filtri, nell'ordine del progetto. La priorità è quella effettiva, cioè il colore del nodo.
export function taskVisibili(progetto: Progetto, effettive: Map<string, PrioritaEffettiva>, filtri: Filtri): Task[] {
  return progetto.task.filter(
    (t) =>
      !(filtri.nascondiFatte && t.stato === "fatta") &&
      ammesso(filtri.priorita, effettive.get(t.id)!.priorita) &&
      ammesso(filtri.costoFocus, t.costoFocus) &&
      ammesso(filtri.costoTempo, t.costoTempo) &&
      ammesso(filtri.stato, t.stato),
  );
}

// Focus su una task: lei, le task da cui dipende e le task che blocca, solo dirette e nell'ordine del progetto.
// Non guarda i filtri, così si vedono anche le task fatte collegate.
export function taskInFocus(progetto: Progetto, taskId: string): Task[] {
  const ids = new Set([taskId]);
  for (const d of progetto.dipendenze) {
    if (d.dipendenteId === taskId) ids.add(d.bloccanteId);
    if (d.bloccanteId === taskId) ids.add(d.dipendenteId);
  }
  return progetto.task.filter((t) => ids.has(t.id));
}

// ——— Catena di verifica ———

// Colonne della catena, da sinistra: task, rischi, test, piani B azione. La task sta ferma nell'origine.
// Spazio di un nodo della catena: lo stile (app.css, .nodo-catena) lo tiene entro 180px e due righe.
export const INGOMBRO_CATENA = { larghezza: 180, altezza: 64 } as const;
const PASSO_CATENA_X = INGOMBRO_CATENA.larghezza + 60;
const PASSO_CATENA_Y = INGOMBRO_CATENA.altezza + 20;
const COLONNA_CATENA = { rischio: PASSO_CATENA_X, test: 2 * PASSO_CATENA_X, azione: 3 * PASSO_CATENA_X } as const;

function posizioniCatena(rischi: Rischio[]): Posizione[] {
  return rischi.flatMap((r) => [
    r.posizione,
    ...r.test.flatMap((t) => [t.posizione, ...(t.pianoB?.tipo === "azione" ? [t.pianoB.posizione] : [])]),
  ]);
}

// Primo posto libero nella colonna, scendendo dall'altezza «da» (il nodo da cui il nuovo nodo parte).
function postoLiberoCatena(rischi: Rischio[], colonna: keyof typeof COLONNA_CATENA, da: number): Posizione {
  const occupate = posizioniCatena(rischi);
  for (let y = da; ; y += PASSO_CATENA_Y) {
    const posto = { x: COLONNA_CATENA[colonna], y };
    const libero = !occupate.some(
      (p) => Math.abs(p.x - posto.x) < INGOMBRO_CATENA.larghezza && Math.abs(p.y - posto.y) < INGOMBRO_CATENA.altezza,
    );
    if (libero) return posto;
  }
}

// Applica «cambia» alla catena della task. «cambia» restituisce la catena nuova oppure il motivo del rifiuto.
// Una task fatta ha la catena in sola lettura, come i suoi attributi; «disposizione» vale anche da fatta.
function cambiaCatena(
  progetto: Progetto,
  taskId: string,
  cambia: (rischi: Rischio[], task: Task) => Rischio[] | string,
  disposizione = false,
): Esito {
  const task = progetto.task.find((t) => t.id === taskId);
  if (!task) return rifiutato("La task non esiste più.");
  if (task.stato === "fatta" && !disposizione) return rifiutato("Una task fatta non si modifica: riaprila prima.");
  const rischi = cambia(task.rischi, task);
  if (typeof rischi === "string") return rifiutato(rischi);
  return { tipo: "ok", progetto: { ...progetto, task: progetto.task.map((t) => (t.id === taskId ? { ...t, rischi } : t)) } };
}

// Applica «cambia» al test indicato, ovunque sia nella catena.
function cambiaTest(rischi: Rischio[], testId: string, cambia: (test: Test, rischio: Rischio) => Test | string): Rischio[] | string {
  const rischio = rischi.find((r) => r.test.some((t) => t.id === testId));
  if (!rischio) return "Il test non esiste più.";
  const test = rischio.test.find((t) => t.id === testId)!;
  const nuovo = cambia(test, rischio);
  if (typeof nuovo === "string") return nuovo;
  return rischi.map((r) => (r === rischio ? { ...r, test: r.test.map((t) => (t === test ? nuovo : t)) } : r));
}

export function aggiungiRischio(progetto: Progetto, taskId: string, dati: { titolo: string; descrizione?: string }): Esito {
  return cambiaCatena(progetto, taskId, (rischi, task) => {
    if (task.atomica) return "Una task atomica non ha rischi.";
    const titolo = dati.titolo.trim();
    if (!titolo) return "Il titolo del rischio non può essere vuoto.";
    const rischio: Rischio = {
      id: crypto.randomUUID(),
      titolo,
      descrizione: dati.descrizione ?? "",
      posizione: postoLiberoCatena(rischi, "rischio", 0),
      test: [],
    };
    return [...rischi, rischio];
  });
}

export function modificaRischio(
  progetto: Progetto,
  taskId: string,
  rischioId: string,
  modifiche: { titolo?: string; descrizione?: string },
): Esito {
  return cambiaCatena(progetto, taskId, (rischi) => {
    if (!rischi.some((r) => r.id === rischioId)) return "Il rischio non esiste più.";
    const titolo = modifiche.titolo?.trim();
    if (titolo === "") return "Il titolo del rischio non può essere vuoto.";
    return rischi.map((r) => (r.id === rischioId ? { ...r, ...modifiche, titolo: titolo ?? r.titolo } : r));
  });
}

// Con il rischio spariscono i suoi test e i loro piani B.
export function eliminaRischio(progetto: Progetto, taskId: string, rischioId: string): Esito {
  return cambiaCatena(progetto, taskId, (rischi) =>
    rischi.some((r) => r.id === rischioId) ? rischi.filter((r) => r.id !== rischioId) : "Il rischio non esiste più.",
  );
}

export function aggiungiTest(progetto: Progetto, taskId: string, rischioId: string, dati: { titolo: string }): Esito {
  return cambiaCatena(progetto, taskId, (rischi) => {
    const rischio = rischi.find((r) => r.id === rischioId);
    if (!rischio) return "Il rischio non esiste più.";
    const titolo = dati.titolo.trim();
    if (!titolo) return "Il titolo del test non può essere vuoto.";
    const test: Test = {
      id: crypto.randomUUID(),
      titolo,
      esito: "daProvare",
      posizione: postoLiberoCatena(rischi, "test", rischio.posizione.y),
    };
    return rischi.map((r) => (r === rischio ? { ...r, test: [...r.test, test] } : r));
  });
}

export function modificaTest(progetto: Progetto, taskId: string, testId: string, modifiche: { titolo: string }): Esito {
  const titolo = modifiche.titolo.trim();
  return cambiaCatena(progetto, taskId, (rischi) =>
    cambiaTest(rischi, testId, (t) => (titolo ? { ...t, titolo } : "Il titolo del test non può essere vuoto.")),
  );
}

// Con il test sparisce il suo piano B, e anche il piano B degli altri test che puntava a lui.
export function eliminaTest(progetto: Progetto, taskId: string, testId: string): Esito {
  return cambiaCatena(progetto, taskId, (rischi) => {
    if (!rischi.some((r) => r.test.some((t) => t.id === testId))) return "Il test non esiste più.";
    return rischi.map((r) => ({
      ...r,
      test: r.test
        .filter((t) => t.id !== testId)
        .map((t) => {
          if (t.pianoB?.tipo !== "test" || t.pianoB.testId !== testId) return t;
          const { pianoB: _, ...senzaPiano } = t;
          return senzaPiano;
        }),
    }));
  });
}

export function impostaEsito(progetto: Progetto, taskId: string, testId: string, esito: EsitoTest): Esito {
  return cambiaCatena(progetto, taskId, (rischi) => cambiaTest(rischi, testId, (t) => ({ ...t, esito })));
}

// Il piano B sostituisce quello di prima. Di tipo test: un altro test dello stesso rischio.
// Di tipo azione: se il test aveva già un'azione, il nodo resta dov'era.
export function impostaPianoB(
  progetto: Progetto,
  taskId: string,
  testId: string,
  piano: { tipo: "test"; testId: string } | { tipo: "azione"; testo: string },
): Esito {
  return cambiaCatena(progetto, taskId, (rischi) =>
    cambiaTest(rischi, testId, (test, rischio) => {
      if (piano.tipo === "test") {
        if (piano.testId === testId) return "Un test non può essere il piano B di sé stesso.";
        if (!rischio.test.some((t) => t.id === piano.testId)) return "Il piano B di un test è un altro test dello stesso rischio.";
        return { ...test, pianoB: { tipo: "test", testId: piano.testId } };
      }
      const testo = piano.testo.trim();
      if (!testo) return "Il testo dell'azione non può essere vuoto.";
      // Rinominare l'azione non toglie né il suo posto né la task nata da lei.
      if (test.pianoB?.tipo === "azione") return { ...test, pianoB: { ...test.pianoB, testo } };
      return { ...test, pianoB: { tipo: "azione", testo, posizione: postoLiberoCatena(rischi, "azione", test.posizione.y) } };
    }),
  );
}

export function rimuoviPianoB(progetto: Progetto, taskId: string, testId: string): Esito {
  return cambiaCatena(progetto, taskId, (rischi) =>
    cambiaTest(rischi, testId, (test) => {
      if (!test.pianoB) return "Il test non ha un piano B.";
      const { pianoB: _, ...senzaPiano } = test;
      return senzaPiano;
    }),
  );
}

// Nodo della catena da spostare. Un piano B azione si indica con l'id del suo test.
export type RifNodoCatena = { tipo: "rischio" | "test" | "azione"; id: string };

// La posizione è disposizione, non contenuto: si cambia anche su una task fatta.
export function spostaNodoCatena(progetto: Progetto, taskId: string, nodo: RifNodoCatena, posizione: Posizione): Esito {
  const p = { ...posizione };
  return cambiaCatena(
    progetto,
    taskId,
    (rischi) => {
      if (nodo.tipo === "rischio") {
        if (!rischi.some((r) => r.id === nodo.id)) return "Il rischio non esiste più.";
        return rischi.map((r) => (r.id === nodo.id ? { ...r, posizione: p } : r));
      }
      return cambiaTest(rischi, nodo.id, (t) => {
        if (nodo.tipo === "test") return { ...t, posizione: p };
        if (t.pianoB?.tipo !== "azione") return "Il test non ha un piano B azione.";
        return { ...t, pianoB: { ...t.pianoB, posizione: p } };
      });
    },
    true,
  );
}

// Rischi aperti: almeno un rischio non ancora verificato, cioè senza test o con un test non passato.
export function haRischiAperti(task: Task): boolean {
  return task.rischi.some((r) => r.test.length === 0 || r.test.some((t) => t.esito !== "passato"));
}

// Piani B da eseguire, cioè dei test falliti, nell'ordine della catena:
// «testId» è il test fallito, «bersaglio» il nodo del piano B (l'altro test o l'azione).
export function pianiBDaEseguire(task: Task): { testId: string; bersaglio: RifNodoCatena }[] {
  return task.rischi.flatMap((r) =>
    r.test.flatMap((t) => {
      if (t.esito !== "fallito" || !t.pianoB) return [];
      const bersaglio: RifNodoCatena = t.pianoB.tipo === "test" ? { tipo: "test", id: t.pianoB.testId } : { tipo: "azione", id: t.id };
      return [{ testId: t.id, bersaglio }];
    }),
  );
}

// Perché dal piano B del test non si può creare una task, o undefined se si può:
// serve un piano B azione di un test fallito, non ancora promosso.
export function motivoNonCreaTask(test: Test): string | undefined {
  if (test.pianoB?.tipo !== "azione") return "Si crea una task solo da un piano B azione";
  if (test.esito !== "fallito") return "Si crea una task solo dal piano B di un test fallito";
  if (test.pianoB.taskId) return "Da questo piano B è già nata una task";
  return undefined;
}

type PianoBAzione = Extract<PianoB, { tipo: "azione" }>;

// «Crea task» sul piano B azione di un test fallito: una task alta col titolo dell'azione, che blocca la task
// di partenza (il test fallito la ferma finché il piano B non è fatto), collegata al piano B.
// Un piano B già promosso non crea una seconda task.
export function creaTaskDaPianoB(progetto: Progetto, taskId: string, testId: string, ora: Date): Esito {
  const partenza = progetto.task.find((t) => t.id === taskId);
  if (!partenza) return rifiutato("La task non esiste più.");
  const test = partenza.rischi.flatMap((r) => r.test).find((t) => t.id === testId);
  if (!test) return rifiutato("Il test non esiste più.");
  const motivo = motivoNonCreaTask(test);
  if (motivo) return rifiutato(`${motivo}.`);
  // motivoNonCreaTask garantisce un piano B azione.
  const piano = test.pianoB as PianoBAzione;

  const creata = creaTask(progetto, { titolo: piano.testo }, ora);
  if (creata.tipo !== "ok") return creata;
  // creaTask aggiunge la task in fondo.
  const nuovaId = creata.progetto.task.at(-1)!.id;
  const alta = modificaTask(creata.progetto, nuovaId, { priorita: "alta" });
  if (alta.tipo !== "ok") return alta;
  // cambiaCatena rifiuta una task di partenza fatta: il progetto resta quello di prima.
  const collegata = cambiaCatena(alta.progetto, taskId, (rischi) =>
    cambiaTest(rischi, testId, (t) => ({ ...t, pianoB: { ...piano, taskId: nuovaId } })),
  );
  if (collegata.tipo !== "ok") return collegata;
  // La task nuova non ha dipendenze: non può chiudere un cerchio. Una task di partenza in corso diventa bloccata
  // senza conferma: il test fallito è proprio il motivo per fermarla.
  return aggiungiDipendenza(collegata.progetto, nuovaId, taskId);
}

// Toglie dai piani B della task il collegamento alla task eliminata, così il piano B torna promuovibile.
function scollegaDaPianiB(task: Task, eliminataId: string): Task {
  const collegata = (t: Test): t is Test & { pianoB: PianoBAzione } => t.pianoB?.tipo === "azione" && t.pianoB.taskId === eliminataId;
  if (!task.rischi.some((r) => r.test.some(collegata))) return task;
  return {
    ...task,
    rischi: task.rischi.map((r) => ({
      ...r,
      test: r.test.map((t) => {
        if (!collegata(t)) return t;
        const { taskId: _, ...pianoB } = t.pianoB;
        return { ...t, pianoB };
      }),
    })),
  };
}
