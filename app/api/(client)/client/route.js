import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SPREADSHEET_ID = '1H5Z1OJxzvk39vjtrdDYzESU61NV7DGPw6K_iD97nh7U';
// Cập nhật phạm vi dữ liệu theo yêu cầu
const RANGE_DATA = 'Data!A:O';

async function getSheets(mode = 'read') {
  const scopes = mode === 'read'
    ? ['https://www.googleapis.com/auth/spreadsheets.readonly']
    : ['https://www.googleapis.com/auth/spreadsheets'];

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function GET() {
  try {
    const sheets = await getSheets('read');

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE_DATA,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS',
      fields: 'values',
    });

    const rows = data.values ?? [];
    if (rows.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const headers = rows[0];
    // Tìm vị trí của cột 'phone' một cách linh hoạt
    const phoneColumnIndex = headers.findIndex(header => header.toLowerCase() === 'phone');

    if (phoneColumnIndex === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột 'phone' trong sheet." }, { status: 500 });
    }

    const uniquePhoneMap = new Map();

    rows.slice(1).forEach((row) => {
      const phoneValue = row[phoneColumnIndex];
      if (phoneValue && String(phoneValue).trim() !== '') {
        const normalizedPhone = String(phoneValue).trim().startsWith('0') ? String(phoneValue).trim() : '0' + String(phoneValue).trim();

        const rowData = {};
        headers.forEach((key, idx) => {
          rowData[key] = row[idx] ?? '';
        });

        rowData[headers[phoneColumnIndex]] = normalizedPhone;

        uniquePhoneMap.set(normalizedPhone, rowData);
      }
    });

    const results = Array.from(uniquePhoneMap.values());

    return new Response(JSON.stringify({ data: results.reverse() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch data from Google Sheets' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export async function POST(req) {
  try {
    const { phone, care, studyTry, study, remove } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ status: 1, mes: 'Thiếu số điện thoại (phone)', data: [] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sheets = await getSheets('write');

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!B:B',
      valueRenderOption: 'UNFORMATTED_VALUE',
      majorDimension: 'COLUMNS',
      fields: 'values',
    });
    const normalizePhone = (p) => {
      const s = String(p).trim();
      return s && s[0] !== '0' ? '0' + s : s;
    };
    const phones = (data.values?.[0] ?? []).map(normalizePhone);
    const target = normalizePhone(phone);
    const idx = phones.findIndex(p => p === target);
    if (idx === -1) {
      return new Response(
        JSON.stringify({ status: 1, mes: 'Không tìm thấy phone trong Sheet', data: [] }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const rowNum = idx + 1;

    const { data: oldData } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Data!H${rowNum}:K${rowNum}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      majorDimension: 'ROWS',
      fields: 'values',
    });
    const oldValues = oldData.values?.[0] ?? [];
    const [oldCare = '', oldStudyTry = '', oldStudy = '', oldRemove = ''] = oldValues;

    const newCare = care !== undefined ? care : oldCare;
    const newStudyTry = studyTry !== undefined ? studyTry : oldStudyTry;
    const newStudy = study !== undefined ? study : oldStudy;
    const newRemove = remove !== undefined ? remove : oldRemove;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Data!H${rowNum}:K${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newCare, newStudyTry, newStudy, newRemove]]
      },
    });
    return new Response(
      JSON.stringify({ status: 2, mes: 'Đã cập nhật', data: rowNum }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Error updating sheet:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update Google Sheet' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
