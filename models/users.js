import { Schema, isValidObjectId, model, models } from 'mongoose'

const postUser = new Schema({
  name: {
    type: String,
  },
  address: {
    type: String,
  },
  avt: {
    type: String,
  },
  role: {
    type: Array,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  uid: {
    type: String,
  },
  zalo: { type: Schema.Types.ObjectId, required: true, ref: 'zaloaccounts' }
})

const users = models.user || model('user', postUser)

export default users