import { NextResponse } from 'next/server';
import connectDB from '@/config/connectDB';
import PostArea from '@/models/area';
import { Re_Area } from '@/data/area';

const isValidHexColor = (hex) => {
    if (typeof hex !== 'string') return false;
    const regex = /^#[0-9a-fA-F]{6}$/;
    return regex.test(hex);
};

export async function PUT(request, { params }) {
    const { id } = params;
    try {
        const body = await request.json();
        const { name, room, color } = body;

        if (!name || !color || !Array.isArray(room) || !isValidHexColor(color)) {
            return NextResponse.json({ status: 0, mes: 'Dữ liệu không hợp lệ.', data: [] }, { status: 400 });
        }

        await connectDB();

        const nameConflict = await PostArea.findOne({ name, _id: { $ne: id } }).lean();
        if (nameConflict) {
            return NextResponse.json({ status: 0, mes: `Tên khu vực "${name}" đã tồn tại.`, data: [] }, { status: 409 });
        }

        const updatedArea = await PostArea.findByIdAndUpdate(
            id,
            { name, room, color },
            { new: true, runValidators: true }
        );

        if (!updatedArea) {
            return NextResponse.json({ status: 0, mes: 'Không tìm thấy khu vực để cập nhật.', data: [] }, { status: 404 });
        }
        Re_Area()
        return NextResponse.json({ status: 2, mes: 'Cập nhật khu vực thành công!', data: updatedArea }, { status: 200 });

    } catch (error) {
        return NextResponse.json(
            { status: 0, mes: error.kind === 'ObjectId' ? 'ID không hợp lệ' : error.message, data: [] },
            { status: error.message === 'Authentication failed' ? 401 : 500 }
        );
    }
}