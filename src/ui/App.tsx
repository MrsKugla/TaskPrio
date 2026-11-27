import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  FILTRI_INIZIALI,
  GIORNI_PRESTO_ALTA_PREDEFINITI,
  applicaPrestoAlta,
  creaProgetto,
  prioritaEffettive,
  ripristinaProgetto,
  rinominaProgetto,
  taskInFocus,
  taskVisibili,
  type Esito,
  type Filtri,
  type PrioritaEffettiva,
  type Progetto,
} from "../regole";
import * as persistenza from "../persistenza";
import { BarraFiltri } from "./BarraFiltri";
import { Grafo } from "./Grafo";
import { Aggiornamento } from "./Aggiornamento";
import { RegolaCrt } from "./RegolaCrt";
import { Icona, STILE, Scelta, TERN, applicaSchermo, leggiSchermo, schermoIniziale, type Schermo } from "./schermo";
import { Avviso, Conferma, ChiediTesto } from "./Dialoghi";
import { Tendina } from "./Tendina";

type Pagina = "home" | "impostazioni";
type Dialogo =
  | { tipo: "nuovo" }
  | { tipo: "rinomina"; progetto: Progetto }
  | { tipo: "elimina"; progetto: Progetto }
  | { tipo: "importa"; percorso: string }
  | { tipo: "avviso"; messaggio: string }
  | null;

const FILTRO_BACKUP = [{ name: "Backup di TaskPrio", extensions: ["taskprio"] }];

applicaSchermo(schermoIniziale());

const oggi = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Ogni quanto si ricontrolla la scadenza delle presto alta con l'app aperta.
const INTERVALLO_SCADENZE_MS = 60 * 60 * 1000;

export function App() {
  const [progetti, setProgetti] = useState<Progetto[] | null>(null);
  const [attivoId, setAttivoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState<Pagina>("home");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [versione, setVersione] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [giorniPrestoAlta, setGiorniPrestoAlta] = useState(GIORNI_PRESTO_ALTA_PREDEFINITI);
  const [schermo, setSchermo] = useState<Schermo>(schermoIniziale);
  const [controlloScadenze, setControlloScadenze] = useState(0);
  // I filtri non si salvano: a ogni avvio si riparte da «Nascondi fatte» acceso.
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_INIZIALI);
  // Durante il focus i filtri restano fermi: uscendo tornano quelli di prima.
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersione);
  }, []);

  useEffect(() => applicaSchermo(schermo), [schermo]);

  // Il foglio dello stile si carica all'avvio (main.tsx): se i dati salvati dicono un altro stile
  // (localStorage svuotato, importazione di un backup) si ricarica con quello giusto.
  // Con una finestra aperta si aspetta che si chiuda: dopo un'importazione dice dove sono i dati di prima.
  useEffect(() => {
    if (schermo.stile !== STILE && dialogo === null) location.reload();
  }, [schermo.stile, dialogo]);

  // All'avvio e dopo un'importazione: tutto lo stato riparte dai dati salvati.
  const mostraDati = (dati: persistenza.DatiSalvati) => {
    setProgetti(dati.progetti.map(ripristinaProgetto));
    setGiorniPrestoAlta(dati.giorniPrestoAlta ?? GIORNI_PRESTO_ALTA_PREDEFINITI);
    setSchermo(leggiSchermo(dati));
    const ultimo = dati.progetti.find((p) => p.id === dati.ultimoProgettoId) ?? dati.progetti[0];
    setAttivoId(ultimo?.id ?? null);
    setTaskId(null);
    setFocusId(null);
  };

  useEffect(() => {
    persistenza
      .caricaDati()
      .then(mostraDati)
      .catch((e) => setErrore(`Impossibile caricare i dati: ${e}`));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setControlloScadenze((n) => n + 1), INTERVALLO_SCADENZE_MS);
    return () => clearInterval(timer);
  }, []);

  const segnalaErrore = (e: unknown) => setErrore(`Salvataggio non riuscito: ${e}`);

  // Le presto alta scadute si memorizzano nel progetto: lo scatto è definitivo, anche se poi cambiano i giorni.
  // applicaPrestoAlta restituisce lo stesso progetto se nulla scade, quindi l'effetto non si ripete all'infinito.
  useEffect(() => {
    if (!progetti) return;
    const ora = new Date();
    const aggiornati = progetti.map((p) => applicaPrestoAlta(p, ora, giorniPrestoAlta));
    const scaduti = aggiornati.filter((p, i) => p !== progetti[i]);
    if (scaduti.length === 0) return;
    setProgetti(aggiornati);
    for (const p of scaduti) persistenza.salvaProgetto(p).catch(segnalaErrore);
  }, [progetti, giorniPrestoAlta, controlloScadenze]);

  const seleziona = (id: string | null) => {
    setAttivoId(id);
    setTaskId(null);
    setFocusId(null);
    persistenza.impostaUltimoProgetto(id).catch(segnalaErrore);
  };

  // Ogni modifica passa da qui: aggiorna lo stato e salva subito.
  const applica = (esito: Esito): boolean => {
    if (esito.tipo === "rifiutato") {
      setErrore(esito.motivo);
      return false;
    }
    const aggiornato = esito.progetto;
    setProgetti((attuali) => {
      const lista = attuali ?? [];
      return lista.some((p) => p.id === aggiornato.id)
        ? lista.map((p) => (p.id === aggiornato.id ? aggiornato : p))
        : [...lista, aggiornato];
    });
    setErrore(null);
    persistenza.salvaProgetto(aggiornato).catch(segnalaErrore);
    return true;
  };

  const elimina = (progetto: Progetto) => {
    const rimasti = (progetti ?? []).filter((p) => p.id !== progetto.id);
    setProgetti(rimasti);
    persistenza.eliminaProgetto(progetto.id).catch(segnalaErrore);
    if (attivoId === progetto.id) seleziona(rimasti[0]?.id ?? null);
  };

  const attivo = progetti?.find((p) => p.id === attivoId) ?? null;
  const effettive = useMemo(() => (attivo ? prioritaEffettive(attivo) : new Map<string, PrioritaEffettiva>()), [attivo]);

  const cambiaGiorniPrestoAlta = (giorni: number) => {
    setGiorniPrestoAlta(giorni);
    persistenza.impostaGiorniPrestoAlta(giorni).catch(segnalaErrore);
  };

  const cambiaTema = (tema: persistenza.Tema) => {
    setSchermo((s) => ({ ...s, tema }));
    persistenza.impostaTema(tema).catch(segnalaErrore);
  };
  const salvaCrt = () => persistenza.impostaCrt(schermo.crt).catch(segnalaErrore);
  // Lo stile cambia tutta la pagina: si salva, poi la finestra si ricarica con l'altro foglio.
  const cambiaStile = async (stile: persistenza.Stile) => {
    try {
      await persistenza.impostaStile(stile);
      setSchermo((s) => ({ ...s, stile }));
    } catch (e) {
      segnalaErrore(e);
    }
  };

  const esporta = async () => {
    try {
      const percorso = await save({ defaultPath: `taskprio-${oggi()}.taskprio`, filters: FILTRO_BACKUP });
      if (!percorso) return;
      await persistenza.esportaDati(percorso);
      setDialogo({ tipo: "avviso", messaggio: `Dati esportati in ${percorso}` });
    } catch (e) {
      setErrore(String(e));
    }
  };

  const scegliDaImportare = async () => {
    try {
      const percorso = await open({ multiple: false, directory: false, filters: FILTRO_BACKUP });
      if (percorso) setDialogo({ tipo: "importa", percorso });
    } catch (e) {
      setErrore(String(e));
    }
  };

  const importa = async (percorso: string) => {
    setDialogo(null);
    try {
      const { dati, backupAutomatico } = await persistenza.importaDati(percorso);
      mostraDati(dati);
      setErrore(null);
      setDialogo({ tipo: "avviso", messaggio: `Dati importati. I dati di prima sono salvati in ${backupAutomatico}` });
    } catch (e) {
      setErrore(String(e));
      // Di solito il file è rifiutato senza toccare nulla; si ricarica comunque, così lo schermo mostra ciò che è salvato
      // e un salvataggio successivo non mescola dati vecchi e importati.
      persistenza.caricaDati().then(mostraDati).catch(() => {});
    }
  };

  const taskAperta = pagina === "home" ? (attivo?.task.find((t) => t.id === taskId) ?? null) : null;
  const chiudiTendina = useCallback(() => setTaskId(null), []);
  // Se la task in focus viene eliminata non c'è più nulla da mostrare in focus: si torna ai filtri.
  const taskFocus = attivo?.task.find((t) => t.id === focusId) ?? null;
  // La task aperta nella tendina resta visibile anche se non passa i filtri: appena creata o segnata fatta non sparisce.
  const visibili = useMemo(() => {
    if (!attivo) return new Set<string>();
    const task = taskFocus ? taskInFocus(attivo, taskFocus.id) : taskVisibili(attivo, effettive, filtri);
    const ids = new Set(task.map((t) => t.id));
    if (taskAperta) ids.add(taskAperta.id);
    return ids;
  }, [attivo, effettive, filtri, taskFocus, taskAperta]);

  return (
    <div className="layout">
      <nav className={`menu${TERN ? " t-island" : ""}`}>
        {TERN ? (
          <span className="t-brand">
            <span className="t-mark">
              <Icona nome="layers" />
            </span>
            TaskPrio
          </span>
        ) : (
          <h1>TaskPrio</h1>
        )}
        <VoceMenu attiva={pagina === "home"} icona="home" onClick={() => setPagina("home")}>
          Home
        </VoceMenu>
        <VoceMenu attiva={pagina === "impostazioni"} icona="gear" onClick={() => setPagina("impostazioni")}>
          Impostazioni
        </VoceMenu>
        {/* Il CRT appartiene allo stile arcade. */}
        {!TERN && <RegolaCrt valore={schermo.crt} onCambia={(crt) => setSchermo((s) => ({ ...s, crt }))} onSalva={salvaCrt} />}
        {versione && <span className={`versione${TERN ? " t-count" : ""}`}>v{versione}</span>}
      </nav>

      <main className={`centro${TERN ? " t-island" : ""}`}>
        <Aggiornamento />
        {errore && (
          <div className="errore t-callout" data-tone="error" role="alert">
            <Icona nome="warn" />
            {TERN ? <span className="testo">{errore}</span> : errore}
            <button className="t-btn icon sm quiet" onClick={() => setErrore(null)} aria-label="Chiudi avviso">
              {TERN ? <Icona nome="x" /> : "×"}
            </button>
          </div>
        )}

        {pagina === "impostazioni" ? (
          TERN ? (
            <ImpostazioniTern
              giorniPrestoAlta={giorniPrestoAlta}
              onGiorni={cambiaGiorniPrestoAlta}
              schermo={schermo}
              onStile={cambiaStile}
              onTema={cambiaTema}
              onEsporta={esporta}
              onImporta={scegliDaImportare}
            />
          ) : (
          <section className="impostazioni">
            <h2>Impostazioni</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (e.currentTarget.elements.namedItem("giorni") as HTMLInputElement).blur();
              }}
            >
              <label>
                Giorni prima che una presto alta diventi alta
                <CampoGiorni giorni={giorniPrestoAlta} onCambia={cambiaGiorniPrestoAlta} />
              </label>
            </form>
            <p className="nota">
              Contati dalla creazione della task, se è ancora da fare. Il passaggio ad alta è definitivo: cambiare i giorni non
              lo annulla.
            </p>

            <fieldset>
              <legend>Stile</legend>
              <label>
                <input type="radio" name="stile" checked={schermo.stile === "arcade"} onChange={() => cambiaStile("arcade")} />
                Arcade
              </label>
              <label>
                <input type="radio" name="stile" checked={schermo.stile === "tern"} onChange={() => cambiaStile("tern")} />
                Tern
              </label>
            </fieldset>

            <fieldset>
              <legend>Tema</legend>
              <label>
                <input type="radio" name="tema" checked={schermo.tema === "chiaro"} onChange={() => cambiaTema("chiaro")} />
                Chiaro
              </label>
              <label>
                <input type="radio" name="tema" checked={schermo.tema === "scuro"} onChange={() => cambiaTema("scuro")} />
                Scuro
              </label>
            </fieldset>

            <h3>Backup</h3>
            <div className="azioni-backup">
              <button onClick={esporta}>Esporta…</button>
              <button onClick={scegliDaImportare}>Importa…</button>
            </div>
            <p className="nota">
              Esporta salva progetti, task e impostazioni in un unico file, da copiare su un altro PC. Importa sostituisce tutti i
              dati con quelli del file; prima salva da sola una copia dei dati attuali.
            </p>
          </section>
          )
        ) : progetti === null ? (
          <p className={TERN ? "t-empty" : "vuoto"}>Caricamento…</p>
        ) : (
          <>
            <header className="barra">
              <Scelta
                aria-label="Progetto"
                value={attivo?.id ?? ""}
                onChange={(e) => seleziona(e.target.value)}
                disabled={progetti.length === 0}
              >
                {progetti.length === 0 && <option value="">Nessun progetto</option>}
                {progetti.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Scelta>
              <button className="t-btn" onClick={() => setDialogo({ tipo: "nuovo" })}>
                <Icona nome="plus" />
                Nuovo
              </button>
              <button className="t-btn" disabled={!attivo} onClick={() => attivo && setDialogo({ tipo: "rinomina", progetto: attivo })}>
                <Icona nome="pen" />
                Rinomina
              </button>
              <button className="t-btn danger" disabled={!attivo} onClick={() => attivo && setDialogo({ tipo: "elimina", progetto: attivo })}>
                <Icona nome="trash" />
                Elimina
              </button>
            </header>
            {attivo ? (
              <>
                <BarraFiltri filtri={filtri} onCambia={setFiltri} focus={taskFocus} onEsciDalFocus={() => setFocusId(null)} />
                <Grafo
                  key={attivo.id}
                  progetto={attivo}
                  effettive={effettive}
                  applica={applica}
                  selezionataId={taskAperta?.id ?? null}
                  onSeleziona={setTaskId}
                  visibili={visibili}
                  focusId={taskFocus?.id ?? null}
                />
              </>
            ) : TERN ? (
              <div className="t-empty">
                <span className="t-empty-ic">
                  <Icona nome="folder" />
                </span>
                <p className="t-empty-title">Nessun progetto</p>
                <p>Qui compare il grafo delle task del progetto scelto.</p>
                <div className="t-empty-acts">
                  <button className="t-btn primary" onClick={() => setDialogo({ tipo: "nuovo" })}>
                    <Icona nome="plus" />
                    Nuovo progetto
                  </button>
                </div>
              </div>
            ) : (
              <p className="vuoto">Crea un progetto per iniziare.</p>
            )}
          </>
        )}
      </main>

      {attivo && taskAperta && (
        <Tendina
          key={taskAperta.id}
          progetto={attivo}
          task={taskAperta}
          effettive={effettive}
          applica={applica}
          onChiudi={chiudiTendina}
          onApri={setTaskId}
          inFocus={taskAperta.id === taskFocus?.id}
          onFocus={setFocusId}
        />
      )}

      {dialogo?.tipo === "nuovo" && (
        <ChiediTesto
          titolo="Nuovo progetto"
          etichetta="Nome"
          onAnnulla={() => setDialogo(null)}
          onConferma={(nome) => {
            const esito = creaProgetto(nome, new Date());
            if (applica(esito) && esito.tipo === "ok") {
              seleziona(esito.progetto.id);
              setDialogo(null);
            }
          }}
        />
      )}
      {dialogo?.tipo === "rinomina" && (
        <ChiediTesto
          titolo="Rinomina progetto"
          etichetta="Nome"
          iniziale={dialogo.progetto.nome}
          onAnnulla={() => setDialogo(null)}
          onConferma={(nome) => {
            if (applica(rinominaProgetto(dialogo.progetto, nome))) setDialogo(null);
          }}
        />
      )}
      {dialogo?.tipo === "importa" && (
        <Conferma
          titolo="Importa backup"
          messaggio={`Sostituire tutti i dati attuali con quelli di «${dialogo.percorso}»? Prima dell'importazione i dati attuali vengono salvati in un backup automatico.`}
          etichettaConferma="Importa"
          onAnnulla={() => setDialogo(null)}
          onConferma={() => importa(dialogo.percorso)}
        />
      )}
      {dialogo?.tipo === "avviso" && <Avviso messaggio={dialogo.messaggio} onChiudi={() => setDialogo(null)} />}
      {dialogo?.tipo === "elimina" && (
        <Conferma
          messaggio={`Eliminare il progetto «${dialogo.progetto.nome}» e tutte le sue task?`}
          etichettaConferma="Elimina"
          pericolo
          onAnnulla={() => setDialogo(null)}
          onConferma={() => {
            elimina(dialogo.progetto);
            setDialogo(null);
          }}
        />
      )}
    </div>
  );
}

// Voce del menu: tasto nello stile arcade, riga della barra laterale in tern.
function VoceMenu(props: { attiva: boolean; icona: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`t-nav-row${props.attiva ? " attiva" : ""}`}
      aria-current={props.attiva ? "page" : undefined}
      onClick={props.onClick}
    >
      <Icona nome={props.icona} />
      {props.children}
    </button>
  );
}

// Si salva al «change» nativo, non a ogni tasto: scrivendo «20» passerebbe da «2» e le presto alta più vecchie
// di 2 giorni diventerebbero alte per sempre. Il «change» nativo arriva all'uscita dal campo, con Invio (il modulo
// toglie il fuoco) e dai bottoni meno e più del passo di tern-ui; l'onChange di React invece scatta a ogni tasto.
function CampoGiorni({ id, giorni, onCambia }: { id?: string; giorni: number; onCambia: (giorni: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const conferma = useEffectEvent(() => {
    const campo = ref.current!;
    const nuovi = Number(campo.value);
    if (Number.isInteger(nuovi) && nuovi >= 1 && nuovi !== giorni) onCambia(nuovi);
    // Un valore non valido non si salva: torna quello salvato.
    else campo.value = String(giorni);
  });
  useEffect(() => {
    const campo = ref.current!;
    const suChange = () => conferma();
    campo.addEventListener("change", suChange);
    return () => campo.removeEventListener("change", suChange);
  }, []);
  // Il campo resta lo stesso: quando il valore salvato arriva o cambia gli si riscrive il valore, così non perde
  // il fuoco dopo un clic su meno o più e tern-ui riaccende o spegne quei bottoni ai limiti.
  useEffect(() => {
    const campo = ref.current!;
    campo.value = String(giorni);
    if (campo.parentElement) globalThis.TernUI?.aggiorna(campo.parentElement);
  }, [giorni]);
  return <input ref={ref} id={id} name="giorni" type="number" min={1} step={1} defaultValue={giorni} />;
}

// Impostazioni nello stile tern: righe di impostazioni di tern-ui (come le preferenze di Tern).
function ImpostazioniTern(props: {
  giorniPrestoAlta: number;
  onGiorni: (giorni: number) => void;
  schermo: Schermo;
  onStile: (stile: persistenza.Stile) => void;
  onTema: (tema: persistenza.Tema) => void;
  onEsporta: () => void;
  onImporta: () => void;
}) {
  const { schermo } = props;
  return (
    <section className="impostazioni">
      <div className="t-doc">
        <header className="t-page-head">
          <h2 className="t-page-title">Impostazioni</h2>
        </header>
        <section>
          <h3 className="t-sec">Priorità</h3>
          <div className="t-rows">
            <div className="t-set">
              <div className="t-set-text">
                <label htmlFor="giorni-presto-alta">Giorni prima che una presto alta diventi alta</label>
                <p>Contati dalla creazione della task, se è ancora da fare. Il passaggio ad alta è definitivo: cambiare i giorni non lo annulla.</p>
              </div>
              <div className="t-set-ctl">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    (e.currentTarget.elements.namedItem("giorni") as HTMLInputElement).blur();
                  }}
                >
                  <div className="t-step lg" role="group" aria-label="Giorni">
                    <button type="button" data-step="down" aria-label="Diminuisci">
                      <Icona nome="minus" />
                    </button>
                    <CampoGiorni id="giorni-presto-alta" giorni={props.giorniPrestoAlta} onCambia={props.onGiorni} />
                    <button type="button" data-step="up" aria-label="Aumenta">
                      <Icona nome="plus" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
        <section>
          <h3 className="t-sec">Aspetto</h3>
          <div className="t-rows">
            <div className="t-set">
              <div className="t-set-text">
                <b>Stile</b>
                <p>Arcade: tasti 3D ed effetto CRT. Tern: i componenti di tern-ui. Cambiando stile la finestra si ricarica.</p>
              </div>
              <div className="t-set-ctl">
                <div className="t-seg lg" role="group" aria-label="Stile">
                  <button aria-pressed={schermo.stile === "arcade"} onClick={() => props.onStile("arcade")}>
                    Arcade
                  </button>
                  <button aria-pressed={schermo.stile === "tern"} onClick={() => props.onStile("tern")}>
                    Tern
                  </button>
                </div>
              </div>
            </div>
            <div className="t-set">
              <div className="t-set-text">
                <b>Tema</b>
              </div>
              <div className="t-set-ctl">
                <div className="t-seg lg" role="group" aria-label="Tema">
                  <button aria-pressed={schermo.tema === "chiaro"} onClick={() => props.onTema("chiaro")}>
                    <Icona nome="sun" />
                    Chiaro
                  </button>
                  <button aria-pressed={schermo.tema === "scuro"} onClick={() => props.onTema("scuro")}>
                    <Icona nome="moon" />
                    Scuro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <h3 className="t-sec">Backup</h3>
          <div className="t-rows">
            <div className="t-set">
              <div className="t-set-text">
                <b>Esporta</b>
                <p>Salva progetti, task e impostazioni in un unico file, da copiare su un altro PC.</p>
              </div>
              <div className="t-set-ctl">
                <button className="t-btn lg raised" onClick={props.onEsporta}>
                  <Icona nome="download" />
                  Esporta…
                </button>
              </div>
            </div>
            <div className="t-set">
              <div className="t-set-text">
                <b>Importa</b>
                <p>Sostituisce tutti i dati con quelli del file; prima salva da sola una copia dei dati attuali.</p>
              </div>
              <div className="t-set-ctl">
                <button className="t-btn lg raised" onClick={props.onImporta}>
                  <Icona nome="upload" />
                  Importa…
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
