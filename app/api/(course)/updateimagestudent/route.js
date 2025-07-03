import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/config/connectDB';
import PostCourse from '@/models/course';

export async function POST(req) {
    await connectDB();

    try {
        const body = await req.json();
        const { studentId, lessonId, newImages } = body;

        if (!studentId || !lessonId || !newImages) {
            return NextResponse.json(
                { success: false, message: "Thiếu trường 'studentId', 'lessonId', hoặc 'newImages'." },
                { status: 400 }
            );
        }
        if (!mongoose.Types.ObjectId.isValid(lessonId)) {
            return NextResponse.json(
                { success: false, message: "Trường 'lessonId' không phải là một ObjectId hợp lệ." },
                { status: 400 }
            );
        }
        if (!Array.isArray(newImages) || newImages.length === 0) {
            return NextResponse.json(
                { success: false, message: "'newImages' phải là một mảng và không được rỗng." },
                { status: 400 }
            );
        }

        const result = await PostCourse.updateOne(
            // Sửa lại filter: Chỉ cần tìm đúng học sinh, arrayFilters sẽ lo phần còn lại.
            { "Detail._id": lessonId, "Student.ID": studentId },
            // Thay đổi $set thành $addToSet với $each
            {
                $set: {
                    "Student.$.Learn.$[learnElem].Image": newImages
                }
            },
            {
                arrayFilters: [{ "learnElem.Lesson": new mongoose.Types.ObjectId(lessonId) }]
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, message: `Không tìm thấy khóa học nào có học sinh với ID: ${studentId}` },
                { status: 404 }
            );
        }

        if (result.modifiedCount === 0) {
            return NextResponse.json(
                { success: true, message: 'Dữ liệu không thay đổi. Có thể do buổi học không tồn tại hoặc tất cả ảnh đã có sẵn.' },
                { status: 200 }
            );
        }

        return NextResponse.json(
            { success: true, message: `Thêm ảnh cho học sinh ${studentId} thành công.` },
            { status: 200 }
        );

    } catch (error) {
        console.error('API Error [add-lesson-images]:', error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ success: false, message: 'Dữ liệu JSON trong body không hợp lệ.' }, { status: 400 });
        }
        return NextResponse.json({ success: false, message: 'Lỗi máy chủ.', error: error.message }, { status: 500 });
    }
}