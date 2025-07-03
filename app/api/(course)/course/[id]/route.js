import connectDB from '@/config/connectDB';
import PostCourse from '@/models/course';
import PostBook from '@/models/book';
import PostArea from '@/models/area';
import Postuser from '@/models/users';
import PostStudent from '@/models/student';
import User from '@/models/users';
import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

export async function GET(request, { params }) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { status: 1, mes: 'Thiếu ID của khóa học.', data: null },
            { status: 400 }
        );
    }

    try {
        await connectDB();

        const course = await PostCourse.findOne({ ID: id })
            .populate([
                { path: 'Book' },
                { path: 'TeacherHR', select: 'name phone' },
                { path: 'Area', select: 'name room color' }
            ])
            .lean();

        if (!course) {
            return NextResponse.json(
                { status: 1, mes: 'Không tìm thấy khóa học.', data: null },
                { status: 404 }
            );
        }

        const userIds = new Set();
        course.Detail?.forEach(d => {
            if (d.Teacher && Types.ObjectId.isValid(d.Teacher)) {
                userIds.add(d.Teacher.toString());
            }
            if (d.TeachingAs && Types.ObjectId.isValid(d.TeachingAs)) {
                userIds.add(d.TeachingAs.toString());
            }
        });

        const lessonIds = [...new Set(course.Detail?.map(d => d.Topic?.toString()).filter(Boolean) || [])];
        const studentIds = course.Student?.map(s => s.ID) || [];

        const promises = [
            userIds.size > 0
                ? User.find({ _id: { $in: Array.from(userIds) } }).select('name phone').lean()
                : Promise.resolve([]),

            lessonIds.length > 0
                ? PostBook.find({ 'Topics._id': { $in: lessonIds.map(lid => new Types.ObjectId(lid)) } }).lean()
                : Promise.resolve([]),

            studentIds.length > 0
                ? PostStudent.find({ ID: { $in: studentIds } }).select('ID Name').lean()
                : Promise.resolve([])
        ];

        const [usersData, relevantBooks, studentsData] = await Promise.all(promises);

        const userDetailsMap = new Map(usersData.map(u => [u._id.toString(), u]));
        const lessonDetailsMap = new Map();

        if (relevantBooks.length > 0) {
            for (const book of relevantBooks) {
                for (const topic of book.Topics) {
                    const topicIdStr = topic._id.toString();
                    if (lessonIds.includes(topicIdStr)) {
                        lessonDetailsMap.set(topicIdStr, topic);
                    }
                }
            }
        }

        if (course.Detail) {
            course.Detail.forEach(detailItem => {
                detailItem.LessonDetails = lessonDetailsMap.get(detailItem.Topic?.toString()) || null;
                detailItem.Teacher = userDetailsMap.get(detailItem.Teacher?.toString()) || null;
                detailItem.TeachingAs = userDetailsMap.get(detailItem.TeachingAs?.toString()) || null;
            });
        }

        if (studentsData.length > 0) {
            const studentInfoMap = new Map(studentsData.map(s => [s.ID, s]));
            course.Student.forEach(studentInCourse => {
                studentInCourse.Name = studentInfoMap.get(studentInCourse.ID)?.Name || 'Không tìm thấy';
            });
        }

        return NextResponse.json(
            { status: 2, mes: 'Lấy dữ liệu chi tiết khóa học thành công.', data: course },
            { status: 200 }
        );

    } catch (error) {
        console.error('[COURSE_DETAILS_GET_BY_ID_ERROR]', error);
        const isCastError = error.name === 'CastError';
        return NextResponse.json(
            { status: 1, mes: isCastError ? 'ID không hợp lệ.' : 'Lỗi từ máy chủ.', data: null },
            { status: isCastError ? 400 : 500 }
        );
    }
}