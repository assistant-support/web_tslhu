/* app/api/course/udetail/route.js */
import connectDB from '@/config/connectDB';
import PostCourse from '@/models/course';
import { NextResponse } from 'next/server';
import { Types, isValidObjectId } from 'mongoose';

const APPSCRIPT = 'https://script.google.com/macros/s/AKfycby4HNPYOKq-XIMpKMqn6qflHHJGQMSSHw6z00-5wuZe5Xtn2OrfGXEztuPj1ynKxj-stw/exec';
const CREATE_LESSON_REQUIRED = ['Day', 'Topic', 'Room', 'Time', 'Teacher'];

// Helper function to format date (e.g., 'YYYY-MM-DD' to 'DD/MM/YYYY')
const formatDay = d => {
    if (/^\d{4}-\d{2}-\d{2}T/.test(d)) { // Check if it's an ISO string (like 2025-06-18T...)
        const date = new Date(d);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    // If it's already in DD/MM/YYYY or another format, return as is, or handle specifically
    // For consistency, if input is 'YYYY-MM-DD', convert it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [year, month, day] = d.split('-');
        return `${day}/${month}/${year}`;
    }
    return d; // Return original if format doesn't match expected
};

export async function POST(request) {
    try {
        const { courseId, detailId, data, student = [], type } = await request.json();

        if (!courseId || !data || typeof data !== 'object') {
            return NextResponse.json({ status: 1, mes: 'Thiếu courseId hoặc data' }, { status: 400 });
        }

        await connectDB();

        // --- Handle 'Học bù' or 'Học thử' (Add new lesson and update student's Learn array) ---
        if (type === 'Học bù' || type === 'Học thử') {
            const missing = CREATE_LESSON_REQUIRED.filter(k => !(k in data));
            if (missing.length) {
                return NextResponse.json({ status: 1, mes: `Thiếu trường khi tạo buổi học: ${missing.join(', ')}` }, { status: 400 });
            }

            // Validate Topic and Teacher ObjectIds
            if (!isValidObjectId(data.Topic)) {
                return NextResponse.json({ status: 1, mes: 'Topic ID không hợp lệ' }, { status: 400 });
            }
            if (!isValidObjectId(data.Teacher)) {
                return NextResponse.json({ status: 1, mes: 'Teacher ID không hợp lệ' }, { status: 400 });
            }
            if (data.TeachingAs && !isValidObjectId(data.TeachingAs)) {
                return NextResponse.json({ status: 1, mes: 'TeachingAs ID không hợp lệ' }, { status: 400 });
            }

            // Ensure Day is a Date object for MongoDB (Schema expects Date)
            const lessonDay = new Date(data.Day);
            if (isNaN(lessonDay.getTime())) {
                return NextResponse.json({ status: 1, mes: 'Định dạng ngày (Day) không hợp lệ.' }, { status: 400 });
            }

            let imageURL = '';
            try {
                const formattedDayForAppscript = formatDay(data.Day);
                const scriptRes = await fetch(`${APPSCRIPT}?ID=${encodeURIComponent(courseId)}&Topic=${encodeURIComponent(formattedDayForAppscript)}`, { cache: 'no-store' });
                if (scriptRes.ok) {
                    const c = await scriptRes.json();
                    if (c?.urls) imageURL = c.urls;
                }
            } catch (err) {
                console.error('[udetail] APPSCRIPT_ERROR:', err);
            }

            // Create a new ObjectId for the new lesson
            const newLessonObjectId = new Types.ObjectId();

            // Construct the new Detail entry
            const newDetailEntry = {
                _id: newLessonObjectId, // MongoDB will use this _id
                Topic: new Types.ObjectId(data.Topic), // Convert to ObjectId
                Day: lessonDay, // Use the Date object
                Room: data.Room,
                Time: data.Time,
                Teacher: new Types.ObjectId(data.Teacher), // Convert to ObjectId
                TeachingAs: data.TeachingAs ? new Types.ObjectId(data.TeachingAs) : null, // Handle optional TeachingAs
                Image: imageURL,
                DetailImage: [], // Default as per schema
                Type: type,
                Note: data.Note || '' // Add Note if provided, else empty string
            };

            // Prepare update operations
            const updateOperations = {
                $push: { Detail: newDetailEntry } // Push the new lesson to Detail array
            };
            
            const studentLearnUpdates = [];
            if (student.length > 0) {
                student.forEach(sId => {
                    studentLearnUpdates.push({
                        "Student.$[elem].Learn": {
                            Checkin: 0,
                            Cmt: [],
                            CmtFn: "",
                            Note: "",
                            Lesson: newLessonObjectId,
                            Image: []
                        }
                    });
                });
            }

            const updatedCourse = await PostCourse.findByIdAndUpdate(
                courseId,
                updateOperations, 
                { new: true, projection: { Detail: 1, ID: 1, Student: 1 } }
            );

            if (!updatedCourse) {
                return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học để thêm buổi học' }, { status: 404 });
            }

            if (student.length > 0) {
                const studentUpdateResult = await PostCourse.updateOne(
                    { _id: courseId },
                    {
                        $push: {
                            "Student.$[studentElem].Learn": { // Push into the Learn array of specific students
                                Checkin: 0,
                                Cmt: [],
                                CmtFn: "",
                                Note: "",
                                Lesson: newLessonObjectId, // Reference the new lesson's _id
                                Image: []
                            }
                        }
                    },
                    {
                        arrayFilters: [{ "studentElem.ID": { $in: student } }], // Filter to update only students whose IDs are in the 'student' array
                        new: true
                    }
                );

                if (studentUpdateResult.matchedCount === 0) {
                    console.warn(`[udetail] No matching students found in course ${courseId} for Learn updates.`);
                }
            }

            return NextResponse.json({ status: 2, mes: `Đã thêm buổi ${type} thành công`, data: updatedCourse }, { status: 200 });
        }

        // --- Handle 'Báo nghỉ' (Update existing lesson's Type and Note) ---
        if (type === 'Báo nghỉ') {
            if (!detailId) {
                return NextResponse.json({ status: 1, mes: 'Thiếu detailId để báo nghỉ' }, { status: 400 });
            }
            if (!isValidObjectId(detailId)) {
                return NextResponse.json({ status: 1, mes: 'detailId không hợp lệ' }, { status: 400 });
            }

            const setObj = {
                'Detail.$.Type': type, // Update the Type of the matched Detail element
                'Detail.$.Note': data.Note || '' // Update the Note of the matched Detail element
            };

            const updated = await PostCourse.findOneAndUpdate(
                { _id: courseId, 'Detail._id': detailId }, // Find by courseId and the specific Detail element's _id
                { $set: setObj },
                { new: true, projection: { Detail: 1, ID: 1 } }
            );

            if (!updated) {
                return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học hoặc buổi học để báo nghỉ' }, { status: 404 });
            }
            return NextResponse.json({ status: 2, mes: 'Báo nghỉ buổi học thành công', data: updated }, { status: 200 });
        }

        if (!detailId) {
            return NextResponse.json({ status: 1, mes: 'Thiếu detailId để cập nhật' }, { status: 400 });
        }
        if (!isValidObjectId(detailId)) {
            return NextResponse.json({ status: 1, mes: 'detailId không hợp lệ' }, { status: 400 });
        }

        const setObj = {};
        const { Room, Teacher, TeachingAs = null, Students: updatedStudentIds = null } = data;

        if (Room !== undefined) {
            setObj['Detail.$.Room'] = Room;
        }
        if (Teacher) {
            if (!isValidObjectId(Teacher)) return NextResponse.json({ status: 1, mes: 'ID giáo viên (Teacher) không hợp lệ' }, { status: 400 });
            setObj['Detail.$.Teacher'] = Teacher;
        }
        if (TeachingAs !== undefined) {
            if (TeachingAs === null) {
                setObj['Detail.$.TeachingAs'] = null;
            } else if (isValidObjectId(TeachingAs)) {
                setObj['Detail.$.TeachingAs'] = new Types.ObjectId(TeachingAs);
            } else {
                return NextResponse.json({ status: 1, mes: 'ID trợ giảng (TeachingAs) không hợp lệ' }, { status: 400 });
            }
        }

        // Perform the update for lesson details first
        let updatedCourse;
        if (Object.keys(setObj).length > 0) {
            updatedCourse = await PostCourse.findOneAndUpdate(
                { _id: courseId, 'Detail._id': detailId },
                { $set: setObj },
                { new: true, projection: { Detail: 1, ID: 1, Student: 1 } } // Project Student for subsequent ops
            );

            if (!updatedCourse) {
                return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học hoặc buổi học để cập nhật' }, { status: 404 });
            }
        } else {
            // If only student updates are happening, fetch the course to get current student data
            updatedCourse = await PostCourse.findById(courseId, { Detail: 1, ID: 1, Student: 1 });
            if (!updatedCourse) {
                return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học để cập nhật học sinh' }, { status: 404 });
            }
        }

        // --- Handle Student participation updates for existing lesson ---
        if (updatedStudentIds !== null) { // Only proceed if Students array is provided in data
            const lessonObjectId = new Types.ObjectId(detailId);

            // 1. Get current students associated with this lesson
            const currentLessonStudents = new Set();
            updatedCourse.Student.forEach(s => {
                if (s.Learn.some(learnItem => learnItem.Lesson.equals(lessonObjectId))) {
                    currentLessonStudents.add(s.ID);
                }
            });

            // Convert updatedStudentIds to a Set for efficient lookup
            const newStudentIdsSet = new Set(updatedStudentIds);

            // Students to remove (currently in lesson, but not in new list)
            const studentsToRemoveLearn = [];
            currentLessonStudents.forEach(sId => {
                if (!newStudentIdsSet.has(sId)) {
                    studentsToRemoveLearn.push(sId);
                }
            });

            // Students to add (in new list, but not currently in lesson)
            const studentsToAddLearn = [];
            newStudentIdsSet.forEach(sId => {
                if (!currentLessonStudents.has(sId)) {
                    studentsToAddLearn.push(sId);
                }
            });

            // Remove Learn entries for students no longer participating
            if (studentsToRemoveLearn.length > 0) {
                await PostCourse.updateOne(
                    { _id: courseId },
                    {
                        $pull: {
                            "Student.$[studentElem].Learn": { Lesson: lessonObjectId }
                        }
                    },
                    {
                        arrayFilters: [{ "studentElem.ID": { $in: studentsToRemoveLearn } }]
                    }
                );
            }

            // Add new Learn entries for newly participating students
            if (studentsToAddLearn.length > 0) {
                // Find the actual student subdocuments to update
                const studentsToUpdate = updatedCourse.Student.filter(s => studentsToAddLearn.includes(s.ID));

                if (studentsToUpdate.length > 0) {
                    // This requires iterating or a more complex single query.
                    // For simplicity and clarity with Mongoose updateOne, iterate.
                    // MongoDB's `arrayFilters` allow targeting specific elements in a top-level array
                    // to then push into a nested array within those elements.
                    await PostCourse.updateOne(
                        { _id: courseId },
                        {
                            $push: {
                                "Student.$[studentElem].Learn": {
                                    Checkin: 0,
                                    Cmt: [],
                                    CmtFn: "",
                                    Note: "",
                                    Lesson: lessonObjectId,
                                    Image: []
                                }
                            }
                        },
                        {
                            arrayFilters: [{ "studentElem.ID": { $in: studentsToAddLearn } }]
                        }
                    );
                }
            }
        }

        return NextResponse.json({ status: 2, mes: 'Cập nhật buổi học thành công', data: updatedCourse }, { status: 200 });

    } catch (err) {
        console.error('[udetail] top-level error:', err);
        return NextResponse.json({ status: 1, mes: err.message || 'Server Error' }, { status: 500 });
    }
}