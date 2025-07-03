import { Schema, model, models } from 'mongoose';

const DetailSchema = new Schema({
    Topic: { type: Schema.Types.ObjectId, required: true },
    Day: { type: Date, required: true },
    Room: { type: String },
    Time: { type: String },
    Teacher: { type: Schema.Types.ObjectId, ref: 'user' },
    TeachingAs: { type: Schema.Types.ObjectId, ref: 'user' },
    Image: { type: String },
    DetailImage: {
        type: [{
            id: { type: String, required: true, unique: true },
            type: { type: String },
            create: { type: Date, default: Date.now }
        }],
        default: []
    },
    Type: { type: String },
    Note: { type: String },
});

const LearnDetailSchema = new Schema({
    Checkin: { type: Number, default: 0 },
    Cmt: { type: Array, default: [] },
    CmtFn: { type: String, default: '' },
    Note: { type: String, default: '' },
    Lesson: { type: Schema.Types.ObjectId, required: true },
    Image: {
        type: [{
            id: { type: String, required: true, unique: true },
            type: { type: String },
            create: { type: Date, default: Date.now }
        }],
        default: []
    },
}, { _id: false });

const StudentSchema = new Schema({
    ID: { type: String, required: true },
    Learn: { type: [LearnDetailSchema], default: [] },
});

const postCourseSchema = new Schema({
    ID: {
        type: String,
        required: true,
        unique: true
    },
    Book: { type: Schema.Types.ObjectId, ref: 'book' },
    Status: {
        type: Boolean,
        default: false
    },
    Type: { type: String },
    Detail: {
        type: [DetailSchema],
        default: []
    },
    Area: {
        type: Schema.Types.ObjectId, ref: 'area'
    },
    Student: {
        type: [StudentSchema],
        default: []
    },
    TeacherHR: {
        type: Schema.Types.ObjectId, ref: 'user'
    },
    Version: {
        type: Number
    }
}, { versionKey: false });

const PostCourse = models.course || model('course', postCourseSchema);

export default PostCourse;