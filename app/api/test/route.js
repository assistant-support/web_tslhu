import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/config/connectDB'; // Thay đổi đường dẫn nếu cần
import PostStudent from '@/models/student';   // Thay đổi đường dẫn nếu cần
import PostCourse from '@/models/course';     // Thay đổi đường dẫn nếu cần

/**
 * API để reset trạng thái của tất cả học sinh và đánh dấu những ai không có khóa học active.
 * Đây là một tác vụ nặng, chỉ nên được gọi khi cần thiết.
 */
export async function POST(request) {
    await dbConnect();

    try {
        console.log('Bắt đầu quá trình reset trạng thái học sinh...');

        // === BƯỚC 1: Reset Status của TẤT CẢ học sinh về giá trị mặc định ===
        const defaultStatus = [{
            status: 2,
            act: 'tạo',
            date: new Date(),
            note: 'Thêm học sinh thành công',
        }];

        await PostStudent.updateMany({}, {
            $set: {
                Status: defaultStatus,
                Leave: false // Reset cả cờ "Leave" nếu cần
            }
        });
        console.log('Bước 1/3: Đã reset trạng thái cho tất cả học sinh.');

        // === BƯỚC 2: Tìm tất cả các học sinh đang có trong một khóa học ACTIVE ===
        // Lấy ra tất cả ID (string) của học sinh từ các khóa học có Status = false
        const activeCourses = await PostCourse.find({ Status: false }, 'Student.ID');

        // Dùng Set để lưu trữ các ID không trùng lặp
        const activeStudentIDs = new Set();
        activeCourses.forEach(course => {
            course.Student.forEach(student => {
                activeStudentIDs.add(student.ID);
            });
        });

        const activeStudentIDsArray = Array.from(activeStudentIDs);
        console.log(`Bước 2/3: Tìm thấy ${activeStudentIDsArray.length} học sinh đang tham gia khóa học active.`);

        // === BƯỚC 3: Cập nhật trạng thái "Nghỉ" cho những học sinh KHÔNG CÓ trong danh sách active ===
        const inactiveStatus = {
            status: 0,
            act: 'nghỉ',
            date: new Date(),
            note: 'Hiện không tham gia khóa học nào',
        };

        const result = await PostStudent.updateMany(
            // Điều kiện: Tìm những học sinh có ID (string) KHÔNG NẰM TRONG danh sách active
            { ID: { $nin: activeStudentIDsArray } },
            // Hành động: Thêm trạng thái "nghỉ" vào mảng Status
            { $push: { Status: inactiveStatus } }
        );
        console.log(`Bước 3/3: Đã cập nhật trạng thái "nghỉ" cho ${result.modifiedCount} học sinh.`);

        return NextResponse.json({
            success: true,
            message: 'Quá trình reset trạng thái học sinh hoàn tất.',
            details: {
                studentsReset: await PostStudent.countDocuments(),
                studentsMarkedAsInactive: result.modifiedCount,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('API Error - Reset Student Statuses:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi máy chủ nội bộ trong quá trình reset.', error: error.message },
            { status: 500 }
        );
    }
}