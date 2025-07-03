import connectDB from '@/config/connectDB';
import PostStudent from '@/models/student';
import '@/models/area';
import '@/models/course';
import '@/models/book';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export async function GET(request) {
    try {
        await connectDB();

        const data = await PostStudent.find({})
            .populate({
                path: 'Area'
            })
            .populate({
                path: 'Course.course',
                model: 'course',
                select: 'ID Status Book',
                populate: {
                    path: 'Book',
                    model: 'book',
                    select: 'Name Price'
                }
            })
            .lean();

        return NextResponse.json(
            { air: 2, mes: 'Lấy danh sách học sinh thành công', data },
            { status: 200 }
        );
    } catch (error) {
        // Log lỗi ra console server để dễ dàng debug
        console.error("Lỗi API lấy danh sách học sinh:", error);
        return NextResponse.json(
            { air: 0, mes: error.message, data: null },
            { status: 500 }
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

export async function POST(request) {
    await connectDB();
    const drive = await getDriveClient();
    let uploadedFileId = null; // Biến để lưu ID file đã tải lên, dùng cho việc dọn dẹp nếu có lỗi

    try {
        const formData = await request.formData();

        // === BƯỚC 1: XỬ LÝ TẢI LÊN AVATAR ===
        const avtFile = formData.get('Avt');
        if (avtFile && avtFile.size > 0) {
            const FOLDER_ID = '1t949fB9rVSQyaZHnCboWDtuLNBjceTl-';
            const fileBuffer = Buffer.from(await avtFile.arrayBuffer());
            const readableStream = new Readable();
            readableStream.push(fileBuffer);
            readableStream.push(null);

            const fileMetadata = {
                name: `avt-${Date.now()}-${avtFile.name}`,
                parents: [FOLDER_ID]
            };
            const media = {
                mimeType: avtFile.type,
                body: readableStream
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });

            uploadedFileId = response.data.id;
            if (!uploadedFileId) {
                throw new Error("Không thể lấy ID file từ Google Drive sau khi tải lên.");
            }
        }

        // === BƯỚC 2: TẠO ID HỌC SINH DUY NHẤT ===
        const studentCount = await PostStudent.countDocuments({});
        let nextIdNumber = studentCount + 1;
        let newId;
        let isIdUnique = false;

        while (!isIdUnique) {
            newId = 'AI' + String(nextIdNumber).padStart(4, '0');
            const existingStudent = await PostStudent.findOne({ ID: newId });
            if (!existingStudent) {
                isIdUnique = true;
            } else {
                nextIdNumber++;
            }
        }

        // === BƯỚC 3: CHUẨN BỊ DỮ LIỆU HỌC SINH ===
        const studentData = {
            Name: formData.get('Name'),
            BD: formData.get('BD'),
            School: formData.get('School'),
            ParentName: formData.get('ParentName'),
            Phone: formData.get('Phone'),
            Email: formData.get('Email'),
            Address: formData.get('Address'),
            Area: formData.get('Area'),
        };

        const initialStatus = {
            status: 2,
            act: 'tạo',
            date: new Date(),
            note: 'Tạo học sinh thành công',
        };

        // === BƯỚC 4: TẠO VÀ LƯU HỌC SINH MỚI VÀO DATABASE ===
        const newStudent = new PostStudent({
            ...studentData,
            ID: newId,
            Avt: uploadedFileId,
            Status: [initialStatus],
        });

        const savedStudent = await newStudent.save();

        // === BƯỚC 4.5: LẤY UID ZALO VÀ CẬP NHẬT (NẾU CÓ) ===
        let finalMessage = 'Tạo học sinh mới thành công!';
        let finalResponseData = savedStudent;

        try {
            const phone = formData.get('Phone');
            if (phone) {
                const appScriptUrl = `${APPSCRIPT_ID}?phone=${encodeURIComponent(phone)}`;
                const appScriptResponse = await fetch(appScriptUrl, { method: 'GET' });

                if (appScriptResponse.ok) {
                    const result = await appScriptResponse.json();
                    if (result.status === 2 && result.data?.uid) {
                        // Cập nhật học sinh với Uid mới
                        const updatedStudent = await PostStudent.findByIdAndUpdate(
                            savedStudent._id,
                            { $set: { Uid: result.data.uid } },
                            { new: true } // Trả về document đã được cập nhật
                        );
                        finalResponseData = updatedStudent || savedStudent; // Dùng data đã update nếu thành công
                    } else {
                        // Lấy uid không thành công, trả về cảnh báo
                        finalMessage = 'Tạo học sinh mới thành công. Lấy uid không thành công, kiểm tra lại số điện thoại liên hệ.';
                    }
                } else {
                    // Lỗi HTTP khi gọi Apps Script
                    finalMessage = 'Tạo học sinh mới thành công. Lấy uid không thành công, kiểm tra lại số điện thoại liên hệ.';
                }
            }
        } catch (zaloError) {
            console.error('Lỗi khi gọi Apps Script hoặc cập nhật Zalo UID:', zaloError);
            finalMessage = 'Tạo học sinh mới thành công. Lấy uid không thành công, kiểm tra lại số điện thoại liên hệ.';
        }

        // === KẾT THÚC: TRẢ VỀ PHẢN HỒI ===
        return NextResponse.json(
            { air: 2, mes: finalMessage, data: finalResponseData },
            { status: 201 }
        );

    } catch (error) {
        // === BƯỚC 5: XỬ LÝ LỖI VÀ DỌN DẸP ===
        if (uploadedFileId) {
            try {
                await drive.files.delete({ fileId: uploadedFileId });
                console.log(`Đã dọn dẹp file rác trên Drive: ${uploadedFileId}`);
            } catch (cleanupError) {
                console.error(`Lỗi khi dọn dẹp file ${uploadedFileId} trên Drive:`, cleanupError);
            }
        }

        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { air: 1, mes: error.message, data: null },
                { status: 400 }
            );
        }

        console.error('Lỗi API [POST /api/students]:', error);
        return NextResponse.json(
            { air: 0, mes: error.message, data: null },
            { status: 500 }
        );
    }
}