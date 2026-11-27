// Aggiornamento automatico: all'avvio l'app legge latest.json dell'ultima release su GitHub (endpoint in tauri.conf.json).
// Il pacchetto si installa solo se la sua firma corrisponde alla chiave pubblica nell'app.
import { useEffect, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Icona, TERN } from "./schermo";

type Stato =
  | { fase: "nessuno" }
  | { fase: "disponibile"; update: Update }
  | { fase: "scarico"; versione: string; percento: number | null }
  | { fase: "errore"; versione: string; messaggio: string };

export function Aggiornamento() {
  const [stato, setStato] = useState<Stato>({ fase: "nessuno" });

  useEffect(() => {
    // Senza rete o senza release il controllo fallisce: l'app funziona lo stesso, quindi non si mostra nulla.
    check()
      .then((update) => update && setStato({ fase: "disponibile", update }))
      .catch((e) => console.warn("Controllo aggiornamenti non riuscito:", e));
  }, []);

  const installa = async (update: Update) => {
    const versione = update.version;
    let totale = 0;
    let scaricati = 0;
    setStato({ fase: "scarico", versione, percento: null });
    try {
      await update.downloadAndInstall((evento) => {
        if (evento.event === "Started") totale = evento.data.contentLength ?? 0;
        if (evento.event === "Progress") {
          scaricati += evento.data.chunkLength;
          setStato({ fase: "scarico", versione, percento: totale ? Math.round((scaricati / totale) * 100) : null });
        }
      });
      await relaunch();
    } catch (e) {
      setStato({ fase: "errore", versione, messaggio: String(e) });
    }
  };

  if (stato.fase === "nessuno") return null;
  return (
    <div className="aggiornamento t-callout" data-tone={stato.fase === "errore" ? "error" : "accent"} role="status">
      <Icona nome={stato.fase === "errore" ? "warn" : "download"} />
      {stato.fase === "disponibile" && (
        <>
          <span className="testo">È disponibile TaskPrio {stato.update.version}.</span>
          <button className="t-btn sm primary" onClick={() => installa(stato.update)}>
            Aggiorna e riavvia
          </button>
          <button className="chiudi t-btn icon sm quiet" onClick={() => setStato({ fase: "nessuno" })} aria-label="Più tardi">
            {TERN ? <Icona nome="x" /> : "×"}
          </button>
        </>
      )}
      {stato.fase === "scarico" && (
        <span className="testo">
          Scarico TaskPrio {stato.versione}… {stato.percento !== null && `${stato.percento}%`}
        </span>
      )}
      {stato.fase === "errore" && (
        <>
          <span className="testo">
            Aggiornamento a {stato.versione} non riuscito: {stato.messaggio}
          </span>
          <button className="chiudi t-btn icon sm quiet" onClick={() => setStato({ fase: "nessuno" })} aria-label="Chiudi avviso">
            {TERN ? <Icona nome="x" /> : "×"}
          </button>
        </>
      )}
    </div>
  );
}
