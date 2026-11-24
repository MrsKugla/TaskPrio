import { useCallback, useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
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
import { Conferma, ChiediTesto } from "./Dialoghi";
import { Tendina } from "./Tendina";

type Pagina = "home" | "impostazioni";
type Dialogo =
  | { tipo: "nuovo" }
  | { tipo: "rinomina"; progetto: Progetto }
  | { tipo: "elimina"; progetto: Progetto }
  | null;

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
  const [controlloScadenze, setControlloScadenze] = useState(0);
  // I filtri non si salvano: a ogni avvio si riparte da «Nascondi fatte» acceso.
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_INIZIALI);
  // Durante il focus i filtri restano fermi: uscendo tornano quelli di prima.
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersione);
  }, []);

  useEffect(() => {
    persistenza
      .caricaDati()
      .then((dati) => {
        setProgetti(dati.progetti.map(ripristinaProgetto));
        setGiorniPrestoAlta(dati.giorniPrestoAlta ?? GIORNI_PRESTO_ALTA_PREDEFINITI);
        const ultimo = dati.progetti.find((p) => p.id === dati.ultimoProgettoId) ?? dati.progetti[0];
        setAttivoId(ultimo?.id ?? null);
      })
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
      <nav className="menu">
        <h1>TaskPrio</h1>
        <button className={pagina === "home" ? "attiva" : ""} onClick={() => setPagina("home")}>
          Home
        </button>
        <button className={pagina === "impostazioni" ? "attiva" : ""} onClick={() => setPagina("impostazioni")}>
          Impostazioni
        </button>
        {versione && <span className="versione">v{versione}</span>}
      </nav>

      <main className="centro">
        {errore && (
          <div className="errore" role="alert">
            {errore}
            <button onClick={() => setErrore(null)} aria-label="Chiudi avviso">
              ×
            </button>
          </div>
        )}

        {pagina === "impostazioni" ? (
          <section className="impostazioni">
            <h2>Impostazioni</h2>
            {/* Si salva all'uscita dal campo o con Invio, non a ogni tasto: scrivendo «20» passerebbe da «2»
                e le presto alta più vecchie di 2 giorni diventerebbero alte per sempre. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (e.currentTarget.elements.namedItem("giorni") as HTMLInputElement).blur();
              }}
            >
              <label>
                Giorni prima che una presto alta diventi alta
                <input
                  // La key fa ripartire il campo quando il valore salvato arriva o cambia.
                  key={giorniPrestoAlta}
                  name="giorni"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={giorniPrestoAlta}
                  onBlur={(e) => {
                    const giorni = Number(e.target.value);
                    if (Number.isInteger(giorni) && giorni >= 1 && giorni !== giorniPrestoAlta) cambiaGiorniPrestoAlta(giorni);
                    // Un valore non valido non si salva: torna quello salvato.
                    else e.target.value = String(giorniPrestoAlta);
                  }}
                />
              </label>
            </form>
            <p className="nota">
              Contati dalla creazione della task, se è ancora da fare. Il passaggio ad alta è definitivo: cambiare i giorni non
              lo annulla.
            </p>
          </section>
        ) : progetti === null ? (
          <p className="vuoto">Caricamento…</p>
        ) : (
          <>
            <header className="barra">
              <select
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
              </select>
              <button onClick={() => setDialogo({ tipo: "nuovo" })}>Nuovo</button>
              <button disabled={!attivo} onClick={() => attivo && setDialogo({ tipo: "rinomina", progetto: attivo })}>
                Rinomina
              </button>
              <button disabled={!attivo} onClick={() => attivo && setDialogo({ tipo: "elimina", progetto: attivo })}>
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
      {dialogo?.tipo === "elimina" && (
        <Conferma
          messaggio={`Eliminare il progetto «${dialogo.progetto.nome}» e tutte le sue task?`}
          etichettaConferma="Elimina"
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
