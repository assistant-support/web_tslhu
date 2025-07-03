import { Schema, model, models } from 'mongoose'

const postArea = new Schema({
  name: {
    type: String
  },
  room: { 
    type: Array
  },
  color: {
    type: String
  }
})

const PostArea = models.area || model('area', postArea)

export default PostArea