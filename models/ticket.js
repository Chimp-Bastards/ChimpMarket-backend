import mongoose from 'mongoose'
import { ObjectId } from 'mongodb';

const Schema = mongoose.Schema

const ticketSchema = new Schema({
  userWallet: String,
  series: Number,
  raffleId: ObjectId,
}, { timestamps: true })

export default mongoose.model('ticket', ticketSchema)