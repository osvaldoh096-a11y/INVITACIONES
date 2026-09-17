import QRCode from 'qrcode';

/**
 * Genera un PNG de QR a partir de un token. El contenido codificado es el
 * propio token (no datos del invitado) — quien lo escanee solo obtiene un
 * identificador opaco, que el endpoint de check-in resuelve contra la base
 * de datos.
 */
export async function generateQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
