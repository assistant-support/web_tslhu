import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import connectToDatabase from '@/config/connectDB';
import ZaloAccount from '@/models/zalo';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcaXcpdsonX5eGRd0T-X_yJejKqD0krSSSV3rYDnpot23nWvXkzO3QnnvIo7UqYss1/exec';
const SPREADSHEET_ID = '1H5Z1OJxzvk39vjtrdDYzESU61NV7DGPw6K_iD97nh7U';
const TARGET_SHEET = 'Account';

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

export async function GET(request) {
    try {
        await connectToDatabase();
        const sheets = await ZaloAccount.find({}, { __v: 0, _id: 0 }).lean();
        return NextResponse.json({ data: sheets }, { status: 200 });
    } catch (error) {
        return NextResponse.json(
            { mes: 'Lỗi khi lấy dữ liệu từ Google Sheet.', error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return NextResponse.json(
                { mes: 'Token không hợp lệ hoặc không được cung cấp.' },
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

        if (!scriptResponse.ok || accountData.error) {
            return NextResponse.json(
                { mes: 'Lỗi khi lấy dữ liệu từ Google Apps Script.', details: accountData },
                { status: 502 }
            );
        }

        const sheets = await getGoogleSheetsClient(true);
        await connectToDatabase();
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

        return NextResponse.json({
            success: true,
            mes: 'Thêm tài khoản thành công.',
            data: accountData,
        });

    } catch (error) {
        return NextResponse.json(
            { mes: 'Đã xảy ra lỗi không xác định.', error: error.message },
            { status: 500 }
        );
    }
}