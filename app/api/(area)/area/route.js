import connectDB from '@/config/connectDB';
import { Re_Area } from '@/data/area';
import PostArea from '@/models/area';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        await connectDB();
        const data = await PostArea.find({}).sort({ createdAt: -1 });
        return NextResponse.json({
            status: 2, // Thay vì 'air'
            mes: 'Lấy dữ liệu thành công',
            data: data
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({
            status: 0,
            mes: error.message,
            data: []
        }, {
            status: error.message === 'Authentication failed' ? 401 : 500
        });
    }
}

export async function POST(request) {
    try {
        await connectDB();

        const body = await request.json();
        const { name, room, color } = body;

        if (!name || !room || !color) {
            return NextResponse.json({
                status: 0,
                mes: "Vui lòng cung cấp đầy đủ các trường: name, room, và color.",
                data: []
            }, { status: 400 });
        }

        const existingArea = await PostArea.findOne({ name });
        if (existingArea) {
            return NextResponse.json({
                status: 0,
                mes: `Khu vực với tên "${name}" đã tồn tại.`,
                data: []
            }, { status: 409 });
        }

        const newArea = new PostArea({ name, room, color });
        await newArea.save();
        await Re_Area();
        return NextResponse.json({
            status: 2,
            mes: "Tạo khu vực mới thành công!",
            data: newArea,
        }, { status: 201 });

    } catch (error) {
        console.error("Lỗi khi tạo khu vực:", error);
        return NextResponse.json({
            status: 0,
            mes: error.message || "Đã xảy ra lỗi từ máy chủ.",
            data: []
        }, {
            status: error.message === 'Authentication failed' ? 401 : 500
        });
    }
}