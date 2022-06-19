import mongoose from 'mongoose'
import dotenv from 'dotenv';

dotenv.config();
const Schema = mongoose.Schema

const auctionSchema = new Schema({
  nftAddress: String,
  nftName: String,
  nftImage: String,
  userWallet: String,
  price: Number,
  isEnd: Boolean,
}, { timestamps: true })

const iguanaBreedingDB = mongoose.connection.useDb(process.env.DB_NAME)
export default iguanaBreedingDB.model('auctions', auctionSchema)