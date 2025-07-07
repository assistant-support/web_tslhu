import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import connectToDatabase from '@/config/connectDB';
import ZaloAccount from '@/models/zalo';
import '@/models/users'
import { Re_acc, Re_user } from '@/data/users';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcaXcpdsonX5eGRd0T-X_yJejKqD0krSSSV3rYDnpot23nWvXkzO3QnnvIo7UqYss1/exec';
const SPREADSHEET_ID = '1H5Z1OJxzvk39vjtrdDYzESU61NV7DGPw6K_iD97nh7U';
const TARGET_SHEET = 'Account';

/**
 * Creates and authenticates a Google Sheets API client.
 * @param {boolean} isWrite - Determines if the client needs write permissions.
 * @returns {Promise<import('googleapis').sheets_v4.Sheets>}
 */
async function getGoogleSheetsClient(isWrite = false) {
    const scopes = isWrite
        ? ['https://www.googleapis.com/auth/spreadsheets']
        : ['https://www.googleapis.com/auth/spreadsheets.readonly'];

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes,
    });
    return google.sheets({ version: 'v4', auth });
}

// --- GET Handler ---
export async function GET(request) {
    try {
        await connectToDatabase();
        const accounts = await ZaloAccount.find({}, { __v: 0 }).populate({ path: 'user', select: 'name phone avt' }).lean();

        // SUCCESS Response
        return NextResponse.json(
            { status: 2, mes: 'Lấy danh sách tài khoản thành công.', data: accounts },
            { status: 200 }
        );
    } catch (error) {
        // ERROR Response
        return NextResponse.json(
            { status: 0, mes: 'Lỗi khi lấy dữ liệu.', data: { error: error.message } },
            { status: 500 }
        );
    }
}

// --- POST Handler ---
export async function POST(request) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token || typeof token !== 'string') {
            // ERROR: Invalid Token
            return NextResponse.json(
                { status: 0, mes: 'Token không hợp lệ hoặc không được cung cấp.', data: null },
                { status: 400 }
            );
        }

        const scriptResponse = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ token }),
            cache: 'no-store',
        });

        const accountData = await scriptResponse.json();
        console.log(accountData, 1);
        
        if (!scriptResponse.ok || accountData.error) {
            // ERROR: Google Apps Script failed
            return NextResponse.json(
                { status: 0, mes: 'Lỗi khi lấy dữ liệu từ Google Apps Script.', data: accountData },
                { status: 502 } // 502 Bad Gateway is appropriate here
            );
        }

        // Prepare data for Sheets and MongoDB
        const newRowForSheet = [
            accountData.phone || '',
            accountData.userId || '',
            accountData.name || '',
            accountData.avatar || '',
            accountData.token || '',
        ];

        const dataForMongo = {
            uid: accountData.userId,
            name: accountData.name,
            phone: accountData.phone,
            avt: accountData.avatar,
        };

        // Connect to DB and get Sheets client
        await connectToDatabase();
        const sheets = await getGoogleSheetsClient(true);

        // Perform writes to Sheets and MongoDB concurrently
        await Promise.all([
            sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${TARGET_SHEET}!A1:E1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [newRowForSheet],
                },
            }),
            ZaloAccount.findOneAndUpdate(
                { uid: dataForMongo.uid },
                dataForMongo,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            )
        ]);
        Re_user();
        Re_acc();
        return NextResponse.json({
            status: 2,
            mes: 'Thêm tài khoản thành công.',
            data: accountData,
        }, { status: 201 });

    } catch (error) {
        return NextResponse.json(
            { status: 0, mes: 'Đã xảy ra lỗi không xác định.', data: { error: error.message } },
            { status: 500 }
        );
    }
}