import { NextResponse } from 'next/server';
import PostCourse from '@/models/course';
import connectDB from '@/config/connectDB';
import mongoose from 'mongoose';


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = parseInt(searchParams.get('month'), 10);
    const yearParam = parseInt(searchParams.get('year'), 10);

    if (
      !Number.isInteger(monthParam) ||
      !Number.isInteger(yearParam) ||
      monthParam < 1 ||
      monthParam > 12
    ) {
      return NextResponse.json(
        { error: 'Tham số month và year không hợp lệ' },
        { status: 400 }
      );
    }

    await connectDB();

    const startDate = new Date(Date.UTC(yearParam, monthParam - 1, 1));
    const endDate = new Date(Date.UTC(yearParam, monthParam, 1));

    const events = await PostCourse.aggregate([
      { $unwind: '$Detail' },
      
      {
        $match: {
          'Detail.Day': {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },

      // BƯỚC 1: Lọc ra danh sách student có tham gia buổi học này
      {
        $addFields: {
          attendingStudents: {
            $filter: {
              input: '$Student',
              as: 'student',
              cond: {
                $anyElementTrue: [
                  {
                    $map: {
                      input: '$$student.Learn',
                      as: 'learnItem',
                      in: {
                        $eq: ['$$learnItem.Lesson', '$Detail._id'],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // *** BƯỚC MỚI: LỌC MẢNG "LEARN" BÊN TRONG MỖI STUDENT ĐÃ TÌM THẤY ***
      {
        $addFields: {
          // Ghi đè lại trường attendingStudents với phiên bản đã được biến đổi
          attendingStudents: {
            // Dùng $map để duyệt qua từng student trong danh sách vừa lọc
            $map: {
              input: '$attendingStudents',
              as: 'student',
              // "in" định nghĩa cấu trúc object mới cho mỗi student
              in: {
                // Dùng $mergeObjects để giữ lại các trường gốc của student (như ID)...
                $mergeObjects: [
                  '$$student',
                  // ...và ghi đè lại trường "Learn"
                  {
                    Learn: {
                      // Lọc mảng Learn của student để chỉ lấy duy nhất learnItem khớp với Detail._id
                      $filter: {
                        input: '$$student.Learn',
                        as: 'learnItem',
                        cond: {
                          $eq: ['$$learnItem.Lesson', '$Detail._id'],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      // *** KẾT THÚC BƯỚC MỚI ***

      // === BẮT ĐẦU CHUỖI XỬ LÝ TOPIC (giữ nguyên) ===
      {
        $lookup: {
          from: 'books',
          localField: 'Book',
          foreignField: '_id',
          as: 'bookInfo',
        },
      },
      {
        $addFields: {
          bookDoc: { $arrayElemAt: ['$bookInfo', 0] },
        },
      },
      {
        $addFields: {
          matchedTopic: {
            $filter: {
              input: '$bookDoc.Topics',
              as: 'topicItem',
              cond: { $eq: ['$$topicItem._id', '$Detail.Topic'] },
            },
          },
        },
      },
      {
        $addFields: {
          topic: { $arrayElemAt: ['$matchedTopic', 0] },
        },
      },
      // === KẾT THÚC CHUỖI XỬ LÝ TOPIC ===

      // Các bước lookup thông tin giáo viên (giữ nguyên)
      {
        $lookup: {
          from: 'users',
          localField: 'Detail.Teacher',
          foreignField: '_id',
          as: 'teacherInfo',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'Detail.TeachingAs',
          foreignField: '_id',
          as: 'teachingAsInfo',
        },
      },

      { $sort: { 'Detail.Day': 1 } },
      
      {
        $project: {
          _id: '$Detail._id',
          courseId: '$ID',
          courseName: '$Name',
          day: { $dayOfMonth: '$Detail.Day' },
          month: { $month: '$Detail.Day' },
          year: { $year: '$Detail.Day' },
          date: '$Detail.Day',
          room: '$Detail.Room',
          time: '$Detail.Time',
          image: '$Detail.Image',
          topic: '$topic',
          teacher: { $arrayElemAt: ['$teacherInfo', 0] },
          teachingAs: { $arrayElemAt: ['$teachingAsInfo', 0] },
          students: '$attendingStudents',
        },
      },
    ]);

    return NextResponse.json(
      { success: true, message: 'Lấy dữ liệu thành công', data: events },
      { status: 200 }
    );
  } catch (error) {
    console.error('Lỗi API lấy lịch trình:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ nội bộ' },
      { status: 500 }
    );
  }
}