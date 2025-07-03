import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import PostCourse from '@/models/course'; // Import model khóa học
import connectDB from '@/config/connectDB';   // Import hàm kết nối DB

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(req) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500, headers: CORS_HEADERS });
        }

        const { data, prompt, courseId, studentId, lessonId } = await req.json();
        if (data === undefined || !prompt) {
            return NextResponse.json({ error: "Request body must include 'data' and 'prompt'." }, { status: 400, headers: CORS_HEADERS });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const contextData = JSON.stringify(data, null, 2);

        const finalPrompt = `
            ${prompt}
            DỮ LIỆU:
            \`\`\`json
            ${contextData}
            \`\`\`
        `;

        const result = await model.generateContent(finalPrompt);
        const output = result.response.text();

        // --- Bắt đầu phần cập nhật cơ sở dữ liệu ---
        if (courseId && studentId && lessonId) {
            await connectDB();

            const course = await PostCourse.findById(courseId);
            if (!course) {
                console.warn(`Database update skipped: Course with _id ${courseId} not found.`);
            } else {
                const student = course.Student.find(s => s.ID === studentId);
                if (!student) {
                    console.warn(`Database update skipped: Student with ID ${studentId} not found in course ${courseId}.`);
                } else {
                    let lessonFound = false;
                    for (const learnDetail of student.Learn.values()) {
                        if (learnDetail.Lesson.toString() === lessonId) {
                            learnDetail.CmtFn = output;
                            lessonFound = true;
                            break;
                        }
                    }

                    if (lessonFound) {
                        await course.save();
                    } else {
                        console.warn(`Database update skipped: Lesson with _id ${lessonId} not found for student ${studentId}.`);
                    }
                }
            }
        }
        // --- Kết thúc phần cập nhật cơ sở dữ liệu ---

        return NextResponse.json({ output }, { status: 200, headers: CORS_HEADERS });

    } catch (error) {
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: errorMessage }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}