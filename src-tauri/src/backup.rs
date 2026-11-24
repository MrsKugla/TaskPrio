// Backup: esporta e importa l'intero database in un unico file. Il file è esso stesso un database SQLite,
// così le tabelle aggiunte in futuro entrano nel backup senza modifiche. Lo riconoscono due campi dell'intestazione:
// «application_id» (è un file di TaskPrio) e «user_version» (versione del formato).

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags, MAIN_DB};

pub const VERSIONE_FORMATO: i32 = 1;
// «TPRI» in ASCII.
const ID_APPLICAZIONE: i32 = 0x5450_5249;

// Marca il database dell'app: l'esportazione copia l'intestazione, quindi ogni backup porta i due campi.
pub fn marca(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(&format!(
        "PRAGMA application_id = {ID_APPLICAZIONE}; PRAGMA user_version = {VERSIONE_FORMATO};"
    ))
}

// Scrive prima un file temporaneo accanto alla destinazione: un'esportazione interrotta non rovina un backup esistente.
pub fn esporta(conn: &Connection, destinazione: &Path) -> Result<(), String> {
    let mut temporaneo = destinazione.as_os_str().to_owned();
    temporaneo.push(".tmp");
    let temporaneo = PathBuf::from(temporaneo);
    let _ = std::fs::remove_file(&temporaneo);
    let esito = conn
        .execute("VACUUM INTO ?1", [temporaneo.to_string_lossy()])
        .map(|_| ())
        .map_err(|e| e.to_string())
        .and_then(|_| std::fs::rename(&temporaneo, destinazione).map_err(|e| e.to_string()));
    if let Err(e) = esito {
        let _ = std::fs::remove_file(&temporaneo);
        return Err(format!("Esportazione non riuscita: {e}"));
    }
    Ok(())
}

fn verifica(origine: &Path) -> Result<(), String> {
    // Un formato futuro potrebbe non essere più SQLite (es. cifrato): anche allora finisce qui, non tra le versioni.
    const NON_VALIDO: &str =
        "Il file scelto non è un backup di TaskPrio, oppure viene da una versione più recente dell'app. I dati non sono stati toccati.";
    let conn = Connection::open_with_flags(origine, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|_| NON_VALIDO)?;
    let pragma = |nome: &str| conn.query_row(&format!("PRAGMA {nome}"), [], |r| r.get::<_, i32>(0));
    // Un file che non è SQLite fallisce già alla prima lettura dell'intestazione.
    if pragma("application_id").map_err(|_| NON_VALIDO)? != ID_APPLICAZIONE {
        return Err(NON_VALIDO.into());
    }
    let versione = pragma("user_version").map_err(|_| NON_VALIDO)?;
    if versione != VERSIONE_FORMATO {
        return Err(format!(
            "Il backup è nel formato versione {versione}, ma questa versione di TaskPrio legge solo la versione {VERSIONE_FORMATO}. Aggiorna TaskPrio e riprova."
        ));
    }
    let danneggiato = |e: String| format!("Il backup è danneggiato e non si può importare ({e}).");
    let esito: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0)).map_err(|e| danneggiato(e.to_string()))?;
    if esito != "ok" {
        return Err(danneggiato(esito));
    }
    crate::carica(&conn).map_err(|e| danneggiato(e.to_string()))?;
    Ok(())
}

// Sostituisce tutti i dati con quelli del file, dopo averlo verificato e aver salvato un backup automatico
// dei dati attuali nella cartella indicata. Restituisce il percorso del backup automatico.
pub fn importa(conn: &mut Connection, origine: &Path, cartella_backup: &Path) -> Result<PathBuf, String> {
    verifica(origine)?;
    let fallito = |e: String| format!("Backup automatico non riuscito, i dati non sono stati toccati: {e}");
    std::fs::create_dir_all(cartella_backup).map_err(|e| fallito(e.to_string()))?;
    let adesso: String = conn
        .query_row("SELECT strftime('%Y-%m-%d_%H-%M-%S', 'now', 'localtime')", [], |r| r.get(0))
        .map_err(|e| fallito(e.to_string()))?;
    let automatico = cartella_backup.join(format!("prima-di-importare_{adesso}.taskprio"));
    esporta(conn, &automatico).map_err(fallito)?;
    // Il ripristino è una sola transazione sul database: se fallisce, i dati restano quelli di prima.
    conn.restore(MAIN_DB, origine, None::<fn(rusqlite::backup::Progress)>)
        .map_err(|e| format!("Importazione non riuscita, i dati non sono stati toccati: {e}"))?;
    Ok(automatico)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{apri, carica, salva, scrivi_impostazione};
    use serde_json::json;

    fn db_con(cartella: &Path, nome: &str, progetti: &[serde_json::Value], giorni: &str) -> Connection {
        let conn = apri(&cartella.join(nome)).unwrap();
        for p in progetti {
            salva(&conn, p).unwrap();
        }
        scrivi_impostazione(&conn, "giorni_presto_alta", giorni).unwrap();
        conn
    }

    fn progetto(id: &str, nome: &str) -> serde_json::Value {
        json!({ "id": id, "nome": nome, "task": [{ "id": "t1", "titolo": "Scrivi «test» è ok" }], "dipendenze": [] })
    }

    #[test]
    fn esporta_e_importa_riportano_dati_identici() {
        let cartella = tempfile::tempdir().unwrap();
        let origine = db_con(cartella.path(), "a.sqlite", &[progetto("p1", "Casa"), progetto("p2", "Lavoro")], "7");
        let file = cartella.path().join("backup.taskprio");
        esporta(&origine, &file).unwrap();

        let mut altro = db_con(cartella.path(), "b.sqlite", &[progetto("p9", "Vecchio")], "12");
        let prima = carica(&altro).unwrap();
        let automatico = importa(&mut altro, &file, &cartella.path().join("automatici")).unwrap();

        assert_eq!(carica(&altro).unwrap(), carica(&origine).unwrap());
        // Il backup automatico contiene i dati di prima dell'importazione.
        let salvati = Connection::open(&automatico).unwrap();
        assert_eq!(carica(&salvati).unwrap(), prima);
    }

    #[test]
    fn esporta_sovrascrive_un_file_esistente() {
        let cartella = tempfile::tempdir().unwrap();
        let conn = db_con(cartella.path(), "a.sqlite", &[progetto("p1", "Casa")], "7");
        let file = cartella.path().join("backup.taskprio");
        std::fs::write(&file, "vecchio").unwrap();
        esporta(&conn, &file).unwrap();
        let mut altro = db_con(cartella.path(), "b.sqlite", &[], "3");
        importa(&mut altro, &file, &cartella.path().join("automatici")).unwrap();
        assert_eq!(carica(&altro).unwrap(), carica(&conn).unwrap());
    }

    fn rifiuta(file: &Path) -> String {
        let cartella = tempfile::tempdir().unwrap();
        let mut conn = db_con(cartella.path(), "a.sqlite", &[progetto("p1", "Casa")], "7");
        let prima = carica(&conn).unwrap();
        let errore = importa(&mut conn, file, &cartella.path().join("automatici")).unwrap_err();
        assert_eq!(carica(&conn).unwrap(), prima);
        errore
    }

    #[test]
    fn file_non_sqlite_rifiutato_senza_toccare_i_dati() {
        let cartella = tempfile::tempdir().unwrap();
        let file = cartella.path().join("appunti.txt");
        std::fs::write(&file, "non sono un backup").unwrap();
        assert!(rifiuta(&file).contains("non è un backup di TaskPrio"));
    }

    #[test]
    fn database_di_altre_app_rifiutato() {
        let cartella = tempfile::tempdir().unwrap();
        let file = cartella.path().join("altro.sqlite");
        Connection::open(&file).unwrap().execute_batch("CREATE TABLE x (a);").unwrap();
        assert!(rifiuta(&file).contains("non è un backup di TaskPrio"));
    }

    #[test]
    fn versione_sconosciuta_rifiutata() {
        let cartella = tempfile::tempdir().unwrap();
        let conn = db_con(cartella.path(), "a.sqlite", &[], "7");
        let file = cartella.path().join("futuro.taskprio");
        esporta(&conn, &file).unwrap();
        Connection::open(&file).unwrap().execute_batch("PRAGMA user_version = 99;").unwrap();
        assert!(rifiuta(&file).contains("versione 99"));
    }

    #[test]
    fn contenuto_illeggibile_rifiutato() {
        let cartella = tempfile::tempdir().unwrap();
        let conn = db_con(cartella.path(), "a.sqlite", &[], "7");
        let file = cartella.path().join("rotto.taskprio");
        esporta(&conn, &file).unwrap();
        Connection::open(&file)
            .unwrap()
            .execute("INSERT INTO progetti (id, dati) VALUES ('x', 'non json')", [])
            .unwrap();
        assert!(rifiuta(&file).contains("danneggiato"));
    }
}
