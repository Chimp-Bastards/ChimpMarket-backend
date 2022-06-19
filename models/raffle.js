import mongoose from 'mongoose'
const Schema = mongoose.Schema

const raffleSchema = new Schema({
  imageUrl: String,
  name: String,
  maxWinners: Number,
  period: Number,
  winners: String,
  endAt: Date,
  isEnd: Boolean
}, { timestamps: true })

export default mongoose.model('raffle', raffleSchema)