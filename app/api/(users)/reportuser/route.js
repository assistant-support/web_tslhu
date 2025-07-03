import { NextResponse } from 'next/server';
import connectToDB from '@/config/connectDB';
import PostCourse from '@/models/course';
import '@/models/users';

export async function GET() {
    try {
        await connectToDB();

        // Lấy thời gian hiện tại một lần bên ngoài vòng lặp để tối ưu hóa
        const now = new Date();

        const courses = await PostCourse.find({})
            .populate({
                path: 'Detail.Teacher',
                model: 'user',
                select: 'name avt phone'
            })
            .lean();

        const teacherData = {};

        for (const course of courses) {
            if (!course.Detail || course.Detail.length === 0) continue;

            for (const lesson of course.Detail) {
                if (!lesson.Teacher || !lesson.Teacher._id) continue;

                const teacherId = lesson.Teacher._id.toString();

                if (!teacherData[teacherId]) {
                    teacherData[teacherId] = {
                        teacherInfo: lesson.Teacher,
                        allLessons: [],
                        totalViolations: 0,
                    };
                }

                const lessonId = lesson._id.toString();

                // --- THAY ĐỔI BẮT ĐẦU TỪ ĐÂY ---

                // Chuyển đổi ngày dạy của buổi học sang đối tượng Date để so sánh
                const lessonDate = new Date(lesson.Day);

                // Kiểm tra nếu ngày dạy là trong tương lai
                if (lessonDate > now) {
                    // Nếu buổi học chưa diễn ra, thêm vào danh sách với trạng thái đặc biệt và bỏ qua kiểm tra lỗi
                    teacherData[teacherId].allLessons.push({
                        lessonId: lessonId,
                        courseId: course.ID,
                        course_id: course._id.toString(),
                        topicId: lesson.Topic,
                        day: lesson.Day,
                        room: lesson.Room,
                        status: 'chưa diễn ra', // Trạng thái mới cho buổi học tương lai
                        isViolation: false,
                        errors: {
                            attendance: false,
                            comment: false,
                            image: false,
                        },
                    });
                    continue; // Chuyển sang buổi học tiếp theo
                }

                // --- KẾT THÚC THAY ĐỔI ---

                // Logic kiểm tra lỗi bên dưới chỉ chạy cho các buổi học đã hoặc đang diễn ra
                let isViolation = false;
                let hasAttendanceViolation = false;
                let hasCommentViolation = false;
                const hasImageViolation = !lesson.DetailImage || lesson.DetailImage.length === 0;

                for (const student of course.Student) {
                    const learnRecord = student.Learn.find(
                        (lr) => lr.Lesson && lr.Lesson.toString() === lessonId
                    );

                    if (learnRecord) {
                        if (learnRecord.Checkin === 0) hasAttendanceViolation = true;
                        if (!learnRecord.Cmt || learnRecord.Cmt.length === 0) hasCommentViolation = true;
                    }
                }

                if (hasAttendanceViolation || hasCommentViolation || hasImageViolation) {
                    isViolation = true;
                    teacherData[teacherId].totalViolations++;
                }

                teacherData[teacherId].allLessons.push({
                    lessonId: lessonId,
                    courseId: course.ID,
                    course_id: course._id.toString(),
                    topicId: lesson.Topic,
                    day: lesson.Day,
                    room: lesson.Room,
                    status: 'đã diễn ra', // Trạng thái cho các buổi học đã qua
                    isViolation: isViolation,
                    errors: {
                        attendance: hasAttendanceViolation,
                        comment: hasCommentViolation,
                        image: hasImageViolation,
                    },
                });
            }
        }

        const result = Object.values(teacherData);
        return NextResponse.json({ status: 2, mes: 'Success', data: result }, { status: 200 });

    } catch (error) {
        console.error("Error fetching teacher reports:", error);
        return NextResponse.json({ status: 0, mes: "Internal Server Error", data: [] }, { status: 500 });
    }
}