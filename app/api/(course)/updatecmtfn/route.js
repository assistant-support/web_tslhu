import { NextResponse } from 'next/server';
import PostCourse from '@/models/course';
import connectDB from '@/config/connectDB';

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(req) {
    try {
        const { courseId, studentId, lessonId, commentText } = await req.json();

        if (!courseId || !studentId || !lessonId || commentText === undefined) {
            return NextResponse.json({ error: "Request body must include 'courseId', 'studentId', 'lessonId', and 'commentText'." }, { status: 400, headers: CORS_HEADERS });
        }

        await connectDB();

        const course = await PostCourse.findById(courseId);
        if (!course) {
            return NextResponse.json({ error: `Course with _id ${courseId} not found.` }, { status: 404, headers: CORS_HEADERS });
        }

        const student = course.Student.find(s => s.ID === studentId);
        if (!student) {
            return NextResponse.json({ error: `Student with ID ${studentId} not found in course ${courseId}.` }, { status: 404, headers: CORS_HEADERS });
        }

        let lessonFound = false;
        for (const learnDetail of student.Learn.values()) {
            if (learnDetail.Lesson.toString() === lessonId) {
                learnDetail.CmtFn = commentText;
                lessonFound = true;
                break;
            }
        }

        if (!lessonFound) {
            return NextResponse.json({ error: `Lesson with _id ${lessonId} not found for student ${studentId}.` }, { status: 404, headers: CORS_HEADERS });
        }

        await course.save();

        return NextResponse.json({ message: "Comment updated successfully." }, { status: 200, headers: CORS_HEADERS });

    } catch (error) {
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: errorMessage }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}