// app/api/sessions/[id]/route.js

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/config/connectDB';
import PostCourse from '@/models/course';
import PostBook from '@/models/book';
import PostStudent from '@/models/student';
import User from '@/models/users';

export async function GET(request, { params }) {
    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
            { success: false, message: 'ID của buổi học không hợp lệ.' },
            { status: 400 }
        );
    }

    try {
        await connectDB();

        const courseData = await PostCourse.findOne(
            { 'Detail._id': id },
            { 'Detail.$': 1, ID: 1, Book: 1, Student: 1, Version: 1 }
        ).lean();

        if (!courseData || !courseData.Detail?.length) {
            return NextResponse.json(
                { success: false, message: 'Buổi học không được tìm thấy.' },
                { status: 404 }
            );
        }

        const session = courseData.Detail[0];

        const userIdsToPopulate = [
            session.Teacher,
            session.TeachingAs,
        ].filter(Boolean);

        const studentStringIds = courseData.Student?.map(s => s.ID) || [];

        const [users, book, students] = await Promise.all([
            User.find({ _id: { $in: userIdsToPopulate } }).select('name').lean(),
            PostBook.findOne({ 'Topics._id': session.Topic }).select({ 'Topics.$': 1 }).lean(),
            // THAY ĐỔI 1: Yêu cầu lấy thêm trường 'Avt'
            PostStudent.find({ ID: { $in: studentStringIds } }).select('ID Name Avt').lean()
        ]);

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // THAY ĐỔI 2: Đổi tên và lưu trữ toàn bộ thông tin học sinh (bao gồm cả Avt)
        const studentInfoMap = new Map(students.map(s => [s.ID, s]));

        session.Teacher = userMap.get(session.Teacher?.toString()) || null;
        session.TeachingAs = userMap.get(session.TeachingAs?.toString()) || null;
        session.Topic = book?.Topics?.[0] || null;

        const studentsWithAttendance = courseData.Student.map(s => {
            const attendance = s.Learn.find(learnItem => learnItem.Lesson.equals(session._id));

            // Lấy thông tin đầy đủ của học sinh từ map
            const studentInfo = studentInfoMap.get(s.ID);

            // THAY ĐỔI 3: Thêm 'Name' và 'Avt' vào đối tượng trả về
            return {
                _id: s._id,
                ID: s.ID,
                Name: studentInfo?.Name || 'Không có tên',
                Avt: studentInfo?.Avt || null, // Thêm trường Avt, fallback là null nếu không có
                attendance: attendance || { Checkin: -1, Cmt: [], Note: '' }
            };
        });

        const responsePayload = {
            course: {
                _id: courseData._id,
                ID: courseData.ID,
                Version: courseData.Version
            },
            session: session,
            students: studentsWithAttendance,
        };

        return NextResponse.json(
            { success: true, message: 'Lấy dữ liệu buổi học thành công', data: responsePayload },
            { status: 200 }
        );

    } catch (error) {
        console.error(`[SESSION_GET_BY_ID_ERROR] ID: ${id}`, error);
        return NextResponse.json(
            { success: false, message: 'Lỗi từ máy chủ.' },
            { status: 500 }
        );
    }
}