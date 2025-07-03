import { NextResponse } from 'next/server';
import PostBook from '@/models/book';
import connectDB from '@/config/connectDB';
import authenticate from '@/utils/authenticate';

export async function GET(request) {
    try {
        await connectDB();
        const data = await PostBook.find();
        return NextResponse.json(
            { status: 200, mes: 'Lấy dữ liệu thành công', data },
            { status: 200 }
        );
    } catch (error) {
        console.error('API GET error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const authResult = await authenticate(request);
        if (!authResult || !authResult.user) {
            return NextResponse.json(
                { status: 1, mes: 'Xác thực không thành công hoặc không tìm thấy người dùng.', data: null },
                { status: 401 }
            );
        }

        const { user, body } = authResult;
        if (!user.role.includes('Admin') && !user.role.includes('Acadamic')) {
            return NextResponse.json(
                { status: 1, mes: 'Bạn không có quyền truy cập vào chức năng này.', data: null },
                { status: 403 }
            );
        }

        await connectDB();
        const { ID, Name, Type, Price, Image, Topics } = body;

        const missingFields = [];
        if (!ID) missingFields.push('ID');
        if (!Name) missingFields.push('Name');
        if (!Type) missingFields.push('Type');
        if (Price === undefined || Price === null) missingFields.push('Price');
        if (!Image) missingFields.push('Image');

        if (missingFields.length > 0) {
            const message = `Dữ liệu không hợp lệ. Các trường sau là bắt buộc: ${missingFields.join(', ')}.`;
            return NextResponse.json({ status: 1, mes: message, data: null }, { status: 400 });
        }

        const urlPattern = new RegExp('^(https?:\\/\\/)?' + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + '((\\d{1,3}\\.){3}\\d{1,3}))' + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + '(\\?[;&a-z\\d%_.~+=-]*)?' + '(\\#[-a-z\\d_]*)?$', 'i');
        if (!urlPattern.test(Image)) {
            return NextResponse.json({ status: 1, mes: 'URL hình ảnh không hợp lệ.', data: null }, { status: 400 });
        }

        const normalizedID = ID.toUpperCase();

        const existingBook = await PostBook.findOne({ ID: normalizedID });
        if (existingBook) {
            return NextResponse.json(
                { status: 1, mes: `ID '${normalizedID}' đã tồn tại. Vui lòng sử dụng một ID khác.`, data: null },
                { status: 409 }
            );
        }

        const newBook = new PostBook({ ID: normalizedID, Name, Type, Price, Image, Topics });

        const savedBook = await newBook.save();

        return NextResponse.json(
            { status: 2, mes: 'Thêm chương trình thành công.', data: savedBook },
            { status: 201 }
        );

    } catch (error) {
        console.error('API POST Error:', error);

        if (error.name === 'ValidationError' || (error.code && error.code === 11000)) {
            const message = error.code === 11000
                ? `ID '${error.keyValue.ID || body.ID.toUpperCase()}' đã tồn tại.`
                : 'Dữ liệu nhập vào không hợp lệ.';
            return NextResponse.json({ status: 1, mes: message, data: null }, { status: 400 });
        }

        return NextResponse.json(
            { status: 1, mes: 'Lỗi máy chủ: Không thể tạo chương trình.', data: null },
            { status: 500 }
        );
    }
}