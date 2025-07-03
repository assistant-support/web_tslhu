import connectDB from '@/config/connectDB';
import PostStudent from '@/models/student';
import PostCourse from '@/models/course';
import { revalidateTag } from 'next/cache';
import PostArea from '@/models/area';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import mongoose from 'mongoose';

export async function GET(request, { params }) {
    const { id } = await params;
    try {
        let data;
        let message = 'Lấy dữ liệu thành công';
        let status = 200;
        await connectDB();
        data = await PostStudent.findById(id);
        return NextResponse.json(
            { air: status === 200 ? 2 : 1, mes: message, data },
            { status }
        );
    } catch (error) {
        return NextResponse.json(
            { air: 0, mes: error.message, data: null },
            { status: error.message === 'Authentication failed' ? 401 : 500 }
        );
    }
}


async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
}

const APPSCRIPT_ID = 'https://script.google.com/macros/s/AKfycbxMMwrvLEuqhsyK__QRCU0Xi6-qu-HkUBx6fDHDRAYfpqM9d4SUq4YKVxpPnZtpJ_b6wg/exec';

// API cập nhật thông tin học sinh
export async function PUT(request, { params }) {
    const { id } = params;
    if (!id) {
        return NextResponse.json({ air: 1, mes: 'Thiếu ID học sinh' }, { status: 400 });
    }

    await connectDB();
    const drive = await getDriveClient();
    let newUploadedFileId = null;

    try {
        const formData = await request.formData();
        const updateData = {};

        // Tìm học sinh hiện có để lấy ID avatar cũ
        const existingStudent = await PostStudent.findById(id).lean();
        if (!existingStudent) {
            return NextResponse.json({ air: 1, mes: 'Không tìm thấy học sinh' }, { status: 404 });
        }

        // 1. Xử lý tải lên avatar mới
        const avtFile = formData.get('Avt');
        if (avtFile && typeof avtFile !== 'string' && avtFile.size > 0) {
            const FOLDER_ID = '1t949fB9rVSQyaZHnCboWDtuLNBjceTl-'; // Thay bằng ID thư mục của bạn
            const fileBuffer = Buffer.from(await avtFile.arrayBuffer());
            const readableStream = Readable.from(fileBuffer);

            const response = await drive.files.create({
                requestBody: { name: `avt-${Date.now()}-${avtFile.name}`, parents: [FOLDER_ID] },
                media: { mimeType: avtFile.type, body: readableStream },
                fields: 'id',
            });

            newUploadedFileId = response.data.id;
            if (!newUploadedFileId) {
                throw new Error("Tải tệp lên Google Drive thất bại.");
            }
            updateData.Avt = newUploadedFileId;
        }

        // 2. Thu thập các trường dữ liệu khác
        const fields = ['Name', 'BD', 'School', 'ParentName', 'Email', 'Address', 'Area'];
        fields.forEach(field => {
            if (formData.has(field)) {
                updateData[field] = formData.get(field);
            }
        });

        // 3. Xử lý cập nhật Zalo UID nếu SĐT thay đổi
        const newPhone = formData.get('Phone');
        if (newPhone && newPhone !== existingStudent.Phone) {
            updateData.Phone = newPhone;
            try {
                const appScriptUrl = `${APPSCRIPT_ID}?phone=${encodeURIComponent(newPhone)}`;
                const appScriptResponse = await fetch(appScriptUrl);
                if (appScriptResponse.ok) {
                    const result = await appScriptResponse.json();
                    if (result.status === 2 && result.data?.uid) {
                        updateData.Uid = result.data.uid;
                    }
                }
            } catch (zaloError) {
                console.error('Lỗi khi cập nhật Zalo UID:', zaloError);
                // Không chặn quá trình, chỉ log lỗi
            }
        }

        // 4. Cập nhật vào Database
        const updatedStudent = await PostStudent.findByIdAndUpdate(id, { $set: updateData }, { new: true }).populate('Area');
        if (!updatedStudent) {
            throw new Error("Cập nhật học sinh thất bại.");
        }

        // 5. Dọn dẹp avatar cũ trên Drive (sau khi đã update DB thành công)
        if (newUploadedFileId && existingStudent.Avt) {
            try {
                await drive.files.delete({ fileId: existingStudent.Avt });
            } catch (cleanupError) {
                console.error(`Lỗi khi dọn dẹp file cũ ${existingStudent.Avt} trên Drive:`, cleanupError);
            }
        }

        // 6. Vô hiệu hóa cache để client có thể load lại dữ liệu mới
        revalidateTag('student');

        return NextResponse.json({ air: 2, mes: 'Cập nhật thông tin thành công!', data: updatedStudent }, { status: 200 });

    } catch (error) {
        // Nếu có lỗi xảy ra sau khi đã tải file mới lên, hãy xóa file mới đó đi
        if (newUploadedFileId) {
            try {
                await drive.files.delete({ fileId: newUploadedFileId });
            } catch (cleanupError) {
                console.error(`Lỗi dọn dẹp file mới ${newUploadedFileId} trên Drive:`, cleanupError);
            }
        }
        return NextResponse.json({ air: 0, mes: error.message, data: null }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { id } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ air: 1, mes: 'ID học sinh không hợp lệ' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { mes } = body; // Lấy lý do nghỉ học từ client

        if (!mes) {
            return NextResponse.json({ air: 1, mes: 'Cần cung cấp lý do báo nghỉ' }, { status: 400 });
        }

        await connectDB();

        // 1. Tìm học sinh để kiểm tra trạng thái
        const student = await PostStudent.findById(id);
        if (!student) {
            return NextResponse.json({ air: 1, mes: 'Không tìm thấy học sinh' }, { status: 404 });
        }

        // 2. Kiểm tra nếu học sinh đã nghỉ rồi
        if (student.Leave === true) {
            return NextResponse.json({ air: 1, mes: 'Học sinh này đã được báo nghỉ trước đó' }, { status: 400 });
        }

        // 3. Xử lý dọn dẹp các khóa học nếu Type = true
        if (student.Type === true) {
            // Lấy danh sách ObjectId các khóa học học sinh tham gia
            const courseIds = student.Course.map(c => c.course);

            // Cập nhật tất cả các khóa học đang hoạt động (Status=false) mà học sinh này tham gia
            // Sử dụng $pull để xóa các buổi học trong mảng Learn có Checkin = 0
            await PostCourse.updateMany(
                {
                    _id: { $in: courseIds },
                    Status: false,
                    'Student.ID': student.ID
                },
                {
                    $pull: { 'Student.$.Learn': { Checkin: 0 } }
                }
            );
        }

        // 4. Cập nhật trạng thái cho học sinh
        const updatedStudent = await PostStudent.findByIdAndUpdate(
            id,
            {
                $set: { Leave: true },
                $push: {
                    Status: {
                        status: 'leave',
                        date: new Date(),
                        note: mes,
                    }
                }
            },
            { new: true } // Trả về document sau khi đã cập nhật
        );

        revalidateTag('student');

        return NextResponse.json({ air: 2, mes: 'Đã cập nhật trạng thái nghỉ học cho học sinh thành công', data: updatedStudent }, { status: 200 });

    } catch (error) {
        console.error("Lỗi khi xử lý báo nghỉ cho học sinh:", error);
        return NextResponse.json({ air: 0, mes: error.message, data: null }, { status: 500 });
    }
}
