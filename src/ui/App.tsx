import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { creaProgetto, rinominaProgetto, type Esito, type Progetto } from "../regole";
import * as persistenza from "../persistenza";
import { Grafo } from "./Grafo";
import { Conferma, ChiediTesto } from "./Dialoghi";

type Pagina = "home" | "impostazioni";
type Dialogo =
  | { tipo: "nuovo" }
  | { tipo: "rinomina"; progetto: Progetto }
  | { tipo: "elimina"; progetto: Progetto }
  | null;

export function App() {
  const [progetti, setProgetti] = useState<Progetto[] | null>(null);
  const [attivoId, setAttivoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState<Pagina>("home");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [versione, setVersione] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersione);
  }, []);

  useEffect(() => {
    persistenza
      .caricaDati()
      .then((dati) => {
        setProgetti(dati.progetti);
        const ultimo = dati.progetti.find((p) => p.id === dati.ultimoProgettoId) ?? dati.progetti[0];
        setAttivoId(ultimo?.id ?? null);
      })
      .catch((e) => setErrore(`Impossibile caricare i dati: ${e}`));
  }, []);

  const segnalaErrore = (e: unknown) => setErrore(`Salvataggio non riuscito: ${e}`);

  const seleziona = (id: string | null) => {
    setAttivoId(id);
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
              <Grafo key={attivo.id} progetto={attivo} applica={applica} />
            ) : (
              <p className="vuoto">Crea un progetto per iniziare.</p>
            )}
          </>
        )}
      </main>

      {/* Tendina di destra: spazio riservato, contenuto dal ticket 02. */}
      <aside className="tendina" />

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
