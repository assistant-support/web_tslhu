// app/api/checkin/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import PostCourse from '@/models/course';
import connectDB from '@/config/connectDB';

export async function POST(req) {
  try {
    const { courseId, sessionId, attendanceData } = await req.json();

    if (
      !courseId ||
      !sessionId ||
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !Array.isArray(attendanceData) ||
      !attendanceData.length
    ) {
      return NextResponse.json({ status: 1, mes: 'Dữ liệu đầu vào không hợp lệ hoặc không đầy đủ.' }, { status: 400 });
    }

    await connectDB();

    const course = await PostCourse.findById(courseId).select('Student.ID').lean();
    if (!course) {
      return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học.' }, { status: 404 });
    }

    const validStudentIds = new Set(course.Student?.map(s => s.ID) ?? []);
    if (validStudentIds.size === 0) {
      return NextResponse.json({ status: 1, mes: 'Khóa học này chưa có học sinh.' }, { status: 400 });
    }

    const processedStudents = new Set();
    const bulkOps = attendanceData
      .filter(({ studentId }) => {
        if (!validStudentIds.has(studentId) || processedStudents.has(studentId)) {
          return false;
        }
        processedStudents.add(studentId);
        return true;
      })
      .map(({ studentId, checkin, comment }) => {
        const setFields = {
          'Student.$[stu].Learn.$[les].Checkin': Number(checkin),
        };

        if (comment !== undefined) {
          setFields['Student.$[stu].Learn.$[les].Cmt'] = comment;
        }

        return {
          updateOne: {
            filter: { _id: courseId },
            update: { $set: setFields },
            arrayFilters: [
              { 'stu.ID': studentId },
              { 'les.Lesson': new mongoose.Types.ObjectId(sessionId) },
            ],
          },
        };
      });

    if (bulkOps.length === 0) {
      return NextResponse.json({ status: 1, mes: 'Không có dữ liệu hợp lệ để cập nhật.' }, { status: 400 });
    }

    const result = await PostCourse.bulkWrite(bulkOps, { ordered: false });

    return NextResponse.json(
      {
        status: 2,
        mes: `Đã cập nhật điểm danh cho ${result.modifiedCount} học sinh.`,
        data: { courseId, sessionId, updatedCount: result.modifiedCount },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API_CHECKIN_ERROR:', error);
    return NextResponse.json(
      { status: 1, mes: 'Lỗi máy chủ khi cập nhật điểm danh.' },
      { status: 500 }
    );
  }
}