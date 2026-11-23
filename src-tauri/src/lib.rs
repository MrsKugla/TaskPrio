// Persistenza: salva e carica il modello in SQLite. Nessuna logica di dominio:
// ogni progetto è un documento JSON prodotto dal modulo regole (TypeScript).

use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

const CHIAVE_ULTIMO_PROGETTO: &str = "ultimo_progetto";
const CHIAVE_GIORNI_PRESTO_ALTA: &str = "giorni_presto_alta";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatiSalvati {
    progetti: Vec<Value>,
    ultimo_progetto_id: Option<String>,
    // Assente finché non si cambia nelle Impostazioni: il valore predefinito lo decide il modulo regole.
    giorni_presto_alta: Option<u32>,
}

fn apri(percorso: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(percorso)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS progetti (id TEXT PRIMARY KEY, dati TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);",
    )?;
    Ok(conn)
}

fn carica(conn: &Connection) -> rusqlite::Result<DatiSalvati> {
    let mut stmt = conn.prepare("SELECT dati FROM progetti ORDER BY rowid")?;
    let progetti = stmt
        .query_map([], |riga| riga.get::<_, String>(0))?
        .map(|testo| {
            let testo = testo?;
            serde_json::from_str(&testo).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
            })
        })
        .collect::<rusqlite::Result<Vec<Value>>>()?;
    let leggi = |chiave: &str| -> rusqlite::Result<Option<String>> {
        conn.query_row("SELECT valore FROM impostazioni WHERE chiave = ?1", [chiave], |riga| riga.get(0))
            .optional()
    };
    let ultimo_progetto_id = leggi(CHIAVE_ULTIMO_PROGETTO)?;
    let giorni_presto_alta = leggi(CHIAVE_GIORNI_PRESTO_ALTA)?.and_then(|v| v.parse().ok());
    Ok(DatiSalvati { progetti, ultimo_progetto_id, giorni_presto_alta })
}

fn scrivi_impostazione(conn: &Connection, chiave: &str, valore: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "INSERT INTO impostazioni (chiave, valore) VALUES (?1, ?2)
         ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore",
        params![chiave, valore],
    )
}

#[tauri::command]
fn carica_dati(db: State<Db>) -> Result<DatiSalvati, String> {
    carica(&db.0.lock().unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn salva_progetto(db: State<Db>, progetto: Value) -> Result<(), String> {
    let id = progetto
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Progetto senza id")?;
    db.0
        .lock()
        .unwrap()
        .execute(
            "INSERT INTO progetti (id, dati) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET dati = excluded.dati",
            params![id, progetto.to_string()],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn elimina_progetto(db: State<Db>, id: String) -> Result<(), String> {
    db.0
        .lock()
        .unwrap()
        .execute("DELETE FROM progetti WHERE id = ?1", [id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn imposta_ultimo_progetto(db: State<Db>, id: Option<String>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let esito = match id {
        Some(id) => scrivi_impostazione(&conn, CHIAVE_ULTIMO_PROGETTO, &id),
        None => conn.execute("DELETE FROM impostazioni WHERE chiave = ?1", [CHIAVE_ULTIMO_PROGETTO]),
    };
    esito.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn imposta_giorni_presto_alta(db: State<Db>, giorni: u32) -> Result<(), String> {
    scrivi_impostazione(&db.0.lock().unwrap(), CHIAVE_GIORNI_PRESTO_ALTA, &giorni.to_string())
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let cartella = app.path().app_data_dir()?;
            std::fs::create_dir_all(&cartella)?;
            let conn = apri(&cartella.join("taskprio.sqlite"))?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            carica_dati,
            salva_progetto,
            elimina_progetto,
            imposta_ultimo_progetto,
            imposta_giorni_presto_alta
        ])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di TaskPrio");
}
