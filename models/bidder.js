import mongoose from 'mongoose'
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';

dotenv.config();
const Schema = mongoose.Schema

const bidderSchema = new Schema({
  userWallet: String,
  auctionId: ObjectId,
  bidPrice: Number,
  isWinner: Boolean,
}, { timestamps: true })

const iguanaBreedingDB = mongoose.connection.useDb(process.env.DB_NAME)
export default iguanaBreedingDB.model('bidders', bidderSchema)