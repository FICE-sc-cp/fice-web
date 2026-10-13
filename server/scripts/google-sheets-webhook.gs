// Google Apps Script behind GOOGLE_SHEETS_WEBHOOK_URL.
// In the spreadsheet: Extensions → Apps Script, paste this file, then
// Deploy → New deployment → Web app (Execute as: Me, Access: Anyone) and put
// the web app URL into GOOGLE_SHEETS_WEBHOOK_URL.
// Applications land in one tab per academic year, e.g. "Заявки 2026-2027"
// (1 Sep 2026 – 31 Aug 2027); the server picks the tab name.
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const tab = (name) => book.getSheetByName(name) || book.insertSheet(name);

  if (data.action === 'append') {
    const sheet = tab(data.sheetName || 'Заявки');
    if (sheet.getLastRow() === 0) sheet.appendRow(data.headers);
    sheet.appendRow(data.row);
  } else if (data.action === 'sync_all') {
    data.sheets.forEach((group) => {
      const values = [data.headers].concat(group.rows);
      const sheet = tab(group.name);
      sheet.clearContents();
      sheet.getRange(1, 1, values.length, data.headers.length).setValues(values);
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
