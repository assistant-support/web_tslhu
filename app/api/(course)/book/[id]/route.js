import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/config/connectDB';
import Book from '@/models/book';
import authenticate from '@/utils/authenticate';

async function validateGoogleSlidesLink(url) {
    if (!url) return { isValid: true };

    const googleSlidesRegex = /^https:\/\/docs\.google\.com\/presentation\/d\/[a-zA-Z0-9_-]+/;
    if (!googleSlidesRegex.test(url)) {
        return { isValid: false, message: 'Link Slide không đúng định dạng của Google Slides.' };
    }

    try {
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (response.url.includes('accounts.google.com')) {
            return { isValid: false, message: 'Link Google Slides phải được chia sẻ công khai (public).' };
        }
        if (!response.ok) {
            return { isValid: false, message: `Link Slide không truy cập được, status code: ${response.status}.` };
        }
        return { isValid: true };
    } catch (error) {
        console.error("Lỗi khi kiểm tra URL Slide:", error);
        return { isValid: false, message: 'Không thể xác thực được URL của Slide do lỗi mạng.' };
    }
}

export async function GET(request, { params }) {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ status: 1, mes: 'ID khóa học không hợp lệ.' }, { status: 400 });
    }

    try {
        await connectDB();
        const course = await Book.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(id) } },
            {
                $project: {
                    Name: 1, Type: 1, Price: 1, TotalLesson: 1, Image: 1, createdAt: 1, updatedAt: 1,
                    Topics: 1
                }
            }
        ]);
        console.log(course);

        if (!course || course.length === 0) {
            return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học với ID này.', data: null }, { status: 404 });
        }
        return NextResponse.json({ status: 2, mes: 'Lấy dữ liệu thành công.', data: course[0] }, { status: 200 });
    } catch (error) {
        console.error("GET /api/books/{id} Error:", error);
        return NextResponse.json({ status: 1, mes: 'Đã có lỗi xảy ra trên máy chủ.' }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ status: 1, mes: 'ID khóa học không hợp lệ.' }, { status: 400 });
    }

    try {
        const authResult = await authenticate(request);
        if (!authResult || !authResult.user) {
            return NextResponse.json({ status: 1, mes: 'Xác thực không thành công.', data: null }, { status: 401 });
        }

        const { user, body } = authResult;
     
        if (!user.role.includes('Admin') && !user.role.includes('Acadamic')) {
            return NextResponse.json({ status: 1, mes: 'Bạn không có quyền truy cập chức năng này.', data: null }, { status: 403 });
        }

        const { topics } = body;
        if (!topics || !Array.isArray(topics) || topics.length === 0) {
            return NextResponse.json({ status: 1, mes: 'Dữ liệu chủ đề không hợp lệ hoặc rỗng.' }, { status: 400 });
        }

        for (const topic of topics) {
            if (topic.Slide) {
                const validation = await validateGoogleSlidesLink(topic.Slide);
                if (!validation.isValid) {
                    return NextResponse.json({ status: 1, mes: `Chủ đề "${topic.Name}": ${validation.message}` }, { status: 400 });
                }
            }
        }

        await connectDB();
        const updatedBook = await Book.findByIdAndUpdate(id, { $push: { Topics: { $each: topics } } }, { new: true, runValidators: true, lean: true });

        if (!updatedBook) {
            return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học để thêm chủ đề.' }, { status: 404 });
        }
        return NextResponse.json({ status: 2, mes: 'Thêm chủ đề mới thành công.', data: updatedBook }, { status: 200 });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const firstErrorKey = Object.keys(error.errors)[0];
            return NextResponse.json({ status: 1, mes: error.errors[firstErrorKey].message }, { status: 400 });
        }
        console.error("POST /api/books/{id} Error:", error);
        return NextResponse.json({ status: 1, mes: 'Đã có lỗi xảy ra trên máy chủ.' }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ status: 1, mes: 'ID khóa học không hợp lệ.' }, { status: 400 });
    }

    try {
        const authResult = await authenticate(request);
        if (!authResult || !authResult.user) {
            return NextResponse.json({ status: 1, mes: 'Xác thực không thành công.', data: null }, { status: 401 });
        }

        const { user, body } = authResult;
        if (!user.role.includes('Admin') && !user.role.includes('Acadamic')) {
            return NextResponse.json({ status: 1, mes: 'Bạn không có quyền truy cập chức năng này.', data: null }, { status: 403 });
        }

        await connectDB();
        let updatedBook;

        if (body.orderedTopicIds) {
            const book = await Book.findById(id);
            if (!book) return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học.' }, { status: 404 });

            const newTopicsOrder = body.orderedTopicIds.map(topicId => book.Topics.find(t => t._id.toString() === topicId)).filter(Boolean);
            if (newTopicsOrder.length !== book.Topics.length) {
                return NextResponse.json({ status: 1, mes: 'Danh sách ID chủ đề để sắp xếp không khớp.' }, { status: 400 });
            }
            book.Topics = newTopicsOrder;
            updatedBook = await book.save();
        } else if (body.topicId && body.updateData) {
            if (!mongoose.Types.ObjectId.isValid(body.topicId)) {
                return NextResponse.json({ status: 1, mes: 'ID chủ đề không hợp lệ.' }, { status: 400 });
            }

            if (body.updateData.Slide) {
                const validation = await validateGoogleSlidesLink(body.updateData.Slide);
                if (!validation.isValid) {
                    return NextResponse.json({ status: 1, mes: validation.message }, { status: 400 });
                }
            }

            const updateFields = Object.entries(body.updateData).reduce((acc, [key, value]) => {
                acc[`Topics.$[elem].${key}`] = value;
                return acc;
            }, {});
            updatedBook = await Book.findByIdAndUpdate(id, { $set: updateFields }, {
                arrayFilters: [{ 'elem._id': new mongoose.Types.ObjectId(body.topicId) }],
                new: true, runValidators: true, lean: true
            });
        } else {
            const { topicId, updateData, orderedTopicIds, ...courseData } = body;
            if (courseData.Image) {
                const urlPattern = new RegExp('^(https?:\\/\\/)?((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$', 'i');
                if (!urlPattern.test(courseData.Image)) {
                    return NextResponse.json({ status: 1, mes: 'URL hình ảnh không hợp lệ.', data: null }, { status: 400 });
                }
            }
            updatedBook = await Book.findByIdAndUpdate(id, { $set: courseData }, { new: true, runValidators: true, lean: true });
        }

        if (!updatedBook) {
            return NextResponse.json({ status: 1, mes: 'Không tìm thấy đối tượng để cập nhật.' }, { status: 404 });
        }
        return NextResponse.json({ status: 2, mes: 'Cập nhật thành công.', data: updatedBook }, { status: 200 });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const firstErrorKey = Object.keys(error.errors)[0];
            return NextResponse.json({ status: 1, mes: error.errors[firstErrorKey].message }, { status: 400 });
        }
        console.error("PUT /api/books/{id} Error:", error);
        return NextResponse.json({ status: 1, mes: 'Đã có lỗi xảy ra trên máy chủ.' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ status: 1, mes: 'ID khóa học không hợp lệ.' }, { status: 400 });
    }

    try {
        const authResult = await authenticate(request);
        if (!authResult || !authResult.user) {
            return NextResponse.json({ status: 1, mes: 'Xác thực không thành công.', data: null }, { status: 401 });
        }


        const { user, body } = authResult;
        console.log(user, 1);
        if (!user.role.includes('Admin') && !user.role.includes('Acadamic')) {
            return NextResponse.json({ status: 1, mes: 'Bạn không có quyền truy cập chức năng này.', data: null }, { status: 403 });
        }

        const { topicId } = body;
        if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
            return NextResponse.json({ status: 1, mes: 'Yêu cầu phải có topicId hợp lệ.' }, { status: 400 });
        }

        await connectDB();
        const result = await Book.updateOne(
            { _id: id, 'Topics._id': new mongoose.Types.ObjectId(topicId) },
            { $set: { 'Topics.$.Status': false } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ status: 1, mes: 'Không tìm thấy khóa học hoặc chủ đề tương ứng.' }, { status: 404 });
        }
        if (result.modifiedCount === 0) {
            return NextResponse.json({ status: 1, mes: 'Chủ đề đã ở trạng thái vô hiệu hóa.' }, { status: 400 });
        }
        return NextResponse.json({ status: 2, mes: 'Vô hiệu hóa chủ đề thành công.', data: result }, { status: 200 });
    } catch (error) {
        console.error("DELETE /api/books/{id} Error:", error);
        return NextResponse.json({ status: 1, mes: 'Đã có lỗi xảy ra trên máy chủ.' }, { status: 500 });
    }
}