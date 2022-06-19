import mongoose from 'mongoose'
const Schema = mongoose.Schema

const userSchema = new Schema({
  userWallet: String,
  tokenAmount: Number,
}, { timestamps: true })

export default mongoose.model('user', userSchema)