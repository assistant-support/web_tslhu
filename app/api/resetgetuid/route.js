import { NextResponse } from 'next/server';
import connectToDatabase from '@/config/connectDB';
import ZaloAccount from '@/models/zalo';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}

export async function GET() {
    try {
        await connectToDatabase();
        const result = await ZaloAccount.updateMany(
            {},
            { $set: { actionsUsedThisHour: 0, rateLimitHourStart: new Date() } }
        );
        return NextResponse.json(
            { message: `Đã đặt lại ${result.modifiedCount} tài khoản.` },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            { message: 'Lỗi khi đặt lại.', error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}