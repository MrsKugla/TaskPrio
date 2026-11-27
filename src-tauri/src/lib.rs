// Persistenza: salva e carica il modello in SQLite. Nessuna logica di dominio:
// ogni progetto è un documento JSON prodotto dal modulo regole (TypeScript).

mod backup;

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

struct Db(Mutex<Connection>);

const CHIAVE_ULTIMO_PROGETTO: &str = "ultimo_progetto";
const CHIAVE_GIORNI_PRESTO_ALTA: &str = "giorni_presto_alta";
const CHIAVE_STILE: &str = "stile";
const CHIAVE_TEMA: &str = "tema";
const CHIAVE_COLORI: &str = "colori";
const CHIAVE_CRT: &str = "crt";

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct DatiSalvati {
    progetti: Vec<Value>,
    ultimo_progetto_id: Option<String>,
    // Assente finché non si cambia nelle Impostazioni: il valore predefinito lo decide il modulo regole.
    giorni_presto_alta: Option<u32>,
    // Assente finché non si sceglie: l'interfaccia parte dallo stile arcade.
    stile: Option<String>,
    // Assente finché non si sceglie: l'interfaccia parte dal tema chiaro.
    tema: Option<String>,
    // Colori dello stile tern; assente finché non si sceglie: l'interfaccia parte da quelli di tern-ui.
    colori: Option<String>,
    // Intensità dell'effetto CRT da 0 a 100; assente finché non si regola (l'interfaccia parte da 0).
    crt: Option<u32>,
}

fn apri(percorso: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(percorso)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS progetti (id TEXT PRIMARY KEY, dati TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);",
    )?;
    backup::marca(&conn)?;
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
    let stile = leggi(CHIAVE_STILE)?;
    let tema = leggi(CHIAVE_TEMA)?;
    let colori = leggi(CHIAVE_COLORI)?;
    let crt = leggi(CHIAVE_CRT)?.and_then(|v| v.parse().ok());
    Ok(DatiSalvati { progetti, ultimo_progetto_id, giorni_presto_alta, stile, tema, colori, crt })
}

fn salva(conn: &Connection, progetto: &Value) -> Result<(), String> {
    let id = progetto
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Progetto senza id")?;
    conn.execute(
        "INSERT INTO progetti (id, dati) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET dati = excluded.dati",
        params![id, progetto.to_string()],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
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
    salva(&db.0.lock().unwrap(), &progetto)
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

#[tauri::command]
fn imposta_stile(db: State<Db>, stile: String) -> Result<(), String> {
    scrivi_impostazione(&db.0.lock().unwrap(), CHIAVE_STILE, &stile)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn imposta_tema(db: State<Db>, tema: String) -> Result<(), String> {
    scrivi_impostazione(&db.0.lock().unwrap(), CHIAVE_TEMA, &tema)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn imposta_colori(db: State<Db>, colori: String) -> Result<(), String> {
    scrivi_impostazione(&db.0.lock().unwrap(), CHIAVE_COLORI, &colori)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn imposta_crt(db: State<Db>, crt: u32) -> Result<(), String> {
    scrivi_impostazione(&db.0.lock().unwrap(), CHIAVE_CRT, &crt.min(100).to_string())
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn esporta_dati(db: State<Db>, percorso: PathBuf) -> Result<(), String> {
    backup::esporta(&db.0.lock().unwrap(), &percorso)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Importati {
    // I dati appena importati, da mostrare al posto di quelli di prima.
    dati: DatiSalvati,
    backup_automatico: PathBuf,
}

#[tauri::command]
fn importa_dati(app: AppHandle, db: State<Db>, percorso: PathBuf) -> Result<Importati, String> {
    let cartella = app.path().app_data_dir().map_err(|e| e.to_string())?.join("backup-automatici");
    let mut conn = db.0.lock().unwrap();
    let backup_automatico = backup::importa(&mut conn, &percorso, &cartella)?;
    let dati = carica(&conn).map_err(|e| e.to_string())?;
    Ok(Importati { dati, backup_automatico })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            imposta_giorni_presto_alta,
            imposta_stile,
            imposta_tema,
            imposta_colori,
            imposta_crt,
            esporta_dati,
            importa_dati
        ])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di TaskPrio");
}
