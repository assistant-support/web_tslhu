// models/Book.js

import { Schema, model, models } from 'mongoose';

// TopicItemSchema không cần thay đổi
const TopicItemSchema = new Schema({
    Name: {
        type: String,
        required: true,
    },
    Period: {
        type: Number,
        required: true,
    },
    Slide: {
        type: String,
        required: true,
    },
    Status: {
        type: Boolean,
        default: true,
    }
}, { _id: true }); // Giữ lại _id cho từng chủ đề trong mảng

const BookSchema = new Schema({
    ID: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    Name: {
        type: String,
        required: [true, 'Tên sách là bắt buộc.'],
        trim: true,
    },
    Type: {
        type: String,
        required: [true, 'Loại sách là bắt buộc.'],
    },
    // --- THAY ĐỔI CHÍNH Ở ĐÂY ---
    Topics: {
        type: [TopicItemSchema], // Chuyển từ Map sang một mảng các TopicItemSchema
        default: [],             // Giá trị mặc định là một mảng rỗng
    },
    Price: {
        type: Number,
        required: true,
        min: [0],
    },
    Image: {
        type: String,
        required: false,
    }
}, { timestamps: true, });

const Book = models.book || model('book', BookSchema);

export default Book;