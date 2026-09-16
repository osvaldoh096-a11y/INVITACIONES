import { google } from 'googleapis';
import type { RSVP, EventProject } from './validations';

/**
 * Sincronización con Google Sheets (tabla maestra).
 *
 * Diseño importante: la base de datos (Postgres) es la fuente de verdad.
 * Sheets es un espejo de solo lectura para que tú puedas ver/filtrar los
 * datos con herramientas conocidas. Si Google Sheets falla (cuota,
 * credenciales vencidas, sin internet), el RSVP del invitado NUNCA se
 * pierde ni falla: se guarda en la base de datos igual, y solo se marca
 * `syncedToSheets = false` con el error, para reintentarlo después.
 *
 * Variables de entorno requeridas:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_PRIVATE_KEY   (con \n literales si viene de un .env de una sola línea)
 * - GOOGLE_SHEET_ID      (el ID de la hoja, de la URL de Google Sheets)
 * - GOOGLE_SHEET_TAB     (opcional, default "RSVPs")
 */

const SHEET_HEADERS = [
  'ID_EVENTO',
  'ID_RESPUESTA',
  'FECHA_HORA',
  'NOMBRE_EVENTO',
  'NOMBRE_INVITADO',
  'ASISTIRA',
  'NUM_ACOMPANANTES',
  'NOMBRES_ACOMPANANTES',
  'TELEFONO',
  'MENSAJE',
  'RESTRICCIONES_ALIMENTARIAS',
];

function isSheetsConfigured(): boolean {
  return Boolean(
    import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      import.meta.env.GOOGLE_PRIVATE_KEY &&
      import.meta.env.GOOGLE_SHEET_ID,
  );
}

function getSheetsClient() {
  const privateKey = (
    import.meta.env.GOOGLE_PRIVATE_KEY as string
  ).replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function ensureHeaderRow(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tab: string,
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:K1`,
  });

  const firstRow = res.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SHEET_HEADERS] },
    });
  }
}

export async function appendRsvpToSheet(
  rsvp: RSVP,
  event: Pick<EventProject, 'eventCode' | 'eventName'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSheetsConfigured()) {
    return {
      ok: false,
      error:
        'Google Sheets no está configurado (faltan variables de entorno GOOGLE_*).',
    };
  }

  try {
    const spreadsheetId = import.meta.env.GOOGLE_SHEET_ID as string;
    const tab =
      (import.meta.env.GOOGLE_SHEET_TAB as string | undefined) || 'RSVPs';

    const sheets = getSheetsClient();
    await ensureHeaderRow(sheets, spreadsheetId, tab);

    const row = [
      event.eventCode,
      rsvp.id,
      new Date(rsvp.createdAt).toISOString(),
      event.eventName,
      rsvp.fullName,
      rsvp.attending ? 'Sí' : 'No',
      String(rsvp.companionsCount ?? 0),
      rsvp.companionNames || '',
      rsvp.phone || '',
      rsvp.message || '',
      rsvp.dietaryRestrictions || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A:K`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error sincronizando con Google Sheets:', message);
    return { ok: false, error: message };
  }
}
