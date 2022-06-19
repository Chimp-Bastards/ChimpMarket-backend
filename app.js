// index.js
import express from "express";
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import {
  transferToken, transferNFT,
  // gettingRadarNFTs 
} from "./solana/index.js";
import dotenv from 'dotenv';
import path from "path"

import userModel from "./models/user.js"
import raffleModel from "./models/raffle.js";
import ticketModel from "./models/ticket.js";

import auctionModel from "./models/auction.js";
import bidderModel from "./models/bidder.js"

import bodyParser from "body-parser";
import cors from "cors";
import url from "url";
import { match } from "assert";
import web3, { LAMPORTS_PER_SOL, PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';

import axios from "axios"

dotenv.config();

const app = express();
app.use(cors({
  origin: "*",
  methods: "post",
  optionsSuccessStatus: 200
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/get-admins', async (req, res) => {
  const admins = process.env.ADMIN_WALLET.split(", ")
  
  console.log(admins)
  
  res.status(200).send({
    admins
  });
})

app.post('/create_raffle', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const raffle = new raffleModel({
    imageUrl: req.body.imageUrl,
    name: req.body.name,
    maxWinners: req.body.maxWinners,
    period: req.body.period,
    endAt: new Date(parseInt(Date.parse(new Date()) + req.body.period * 3600 * 1000)),
    isEnd: false,
  });
  await raffle.save();

  res.status(200).send({
    success: true,
  });

  return
})

app.post('/all-raffles', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const infos = await raffleModel.aggregate([
    {
      $match: {
      }
    },
    {
      $group: {
        _id: "$_id",
        raffles: { $push: '$$ROOT' },
        // count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'tickets',
        localField: '_id',
        foreignField: 'raffleId',
        as: 'tickets'
      }
    }
  ])

  res.status(200).send({
    success: true,
    raffles: infos,
  });
})

app.post('/raffle-detail', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const raffle = await raffleModel.find({
    _id: new ObjectId(req.body.raffleId)
  });

  res.status(200).send({
    success: true,
    raffle: raffle[0]
  });
})

app.post('/buy_tickets', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  let isExist = await userModel.findOne({
    userWallet: req.body.walletAddress,
  });

  if (!isExist) {
    let newUser = new userModel({
      userWallet: req.body.walletAddress,
      tokenAmount: 0.0,
    });

    await newUser.save();
  }

  let tickets = []
  for (let i = 0; i < req.body.ticketCount; i++) {
    const ticket = new ticketModel({
      userWallet: req.body.walletAddress,
      series: random6Series(),
      raffleId: new ObjectId(req.body.raffleId)
    });
    await ticket.save();
    tickets.push(ticket)
  }

  res.status(200).send({
    success: true,
    tickets,
  });

  return
})

const port = normalizePort(process.env.PORT || '5000');

// Connect mongodb
mongoose.connect(process.env.MONGODB_CONNECT_URL, {
  dbName: process.env.DB_NAME,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  user: process.env.USER_NAME,
  pass: process.env.PASSWORD
});

const db = mongoose.connection;
db.once('open', _ => {
  console.log('Database connected:', process.env.MONGODB_CONNECT_URL);
});
db.on('error', err => {
  console.error('connection error:', err);
});

app.listen(port, (error) => {
  if (error) {
    throw new Error(error);
  }
  console.log("Backend is running");
});

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function checkHostname(req) {
  const ref = req.headers.referer;
  if (ref) {
    const u = url.parse(ref);
    // display the url
    console.log(u)
    console.log(u.hostname)
    console.log(process.env.REQUEST_HOSTNAME)

    return u && u.hostname === process.env.REQUEST_HOSTNAME;
  }

  return false;
}

setInterval(async () => {
  const goingRaffles = await raffleModel.find({
    isEnd: false
  });

  // console.log(goingRaffles)
  for (let i = 0; i < goingRaffles.length; i++) {
    const elem = goingRaffles[i];
    const diff = (Date.parse(elem.endAt) - Date.parse(new Date().toString()))

    if (diff <= 0) {
      // get the winners
      const winners = await getWinners(elem)
      console.log(winners)

      await raffleModel.updateOne(
        {
          _id: elem._id,
        },
        {
          winners: JSON.stringify(winners),
        }
      );

      // end raffle
      elem.isEnd = true;
      elem.save()
    }
  }
  // }, 60000); // 1min
  // }, 1000); // 1s
}, 5000); // 5s

// make the random 6 series
const random6Series = () => {
  return Math.floor(Math.random() * 999999)
}

const getWinners = async (raffle) => {
  const uniqueUsers = await ticketModel.aggregate([
    {
      $match: {
        raffleId: raffle._id
      }
    },
    {
      $group: {
        _id: "$userWallet",
        count: { $sum: 1 }
      }
    },
  ])

  let winners = []

  for (let i = 0; i < raffle.maxWinners; i++) {
    const randomIndex = Math.floor(Math.random() * uniqueUsers.length)
    const elem = uniqueUsers.splice(randomIndex, 1)
    if (elem.length == 0) {
      break
    }
    winners.push(elem[0])
  }

  return winners
}

app.post('/all-auctions', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const infos = await auctionModel.aggregate([
    {
      $match: {
      }
    },
    {
      $group: {
        _id: "$_id",
        auction: { $push: '$$ROOT' },
        // count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'bidders',
        localField: '_id',
        foreignField: 'auctionId',
        as: 'bidders'
      }
    }
  ])

  res.status(200).send({
    success: true,
    auctions: infos,
  });
})

app.post('/create_auction', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const auction = new auctionModel({
    nftAddress: req.body.nftAddress,
    nftImage: req.body.nftImage,
    nftName: req.body.nftName,
    userWallet: req.body.walletAddress,
    price: req.body.price,
    isEnd: false,
  });
  await auction.save();

  res.status(200).send({
    success: true,
  });

  return
})

app.post('/auction-detail', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  const auction = await auctionModel.find({
    _id: new ObjectId(req.body.auctionId),
  });

  const bidders = await bidderModel.find({
    auctionId: req.body.auctionId,
  });

  res.status(200).send({
    success: true,
    auction: auction[0],
    bidders,
  });
})

app.post('/auction-bid', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  let user = await userModel.findOne({
    userWallet: req.body.walletAddress,
  });

  if (!user) {
    let newUser = new userModel({
      userWallet: req.body.walletAddress,
      tokenAmount: 0.0,
    });

    await newUser.save();
  }

  let isExist = await bidderModel.findOne({
    auctionId: req.body.auctionId,
    userWallet: req.body.walletAddress,
  });

  if (isExist) {
    res.status(200).send({
      success: false,
    });

    return
  }

  let newBidder = new bidderModel({
    auctionId: new ObjectId(req.body.auctionId),
    userWallet: req.body.walletAddress,
    bidPrice: req.body.bidPrice,
    isWinner: false,
  });

  await newBidder.save();

  res.status(200).send({
    success: true,
  });
})

app.post('/accept-bid', async (req, res) => {
  if (!checkHostname(req)) {
    res.status(403).send("Invalid Origin");
    return;
  }

  let auction = await auctionModel.findOne({
    _id: new ObjectId(req.body.auctionId),
    userWallet: req.body.walletAddress,
  });

  if (!auction) {
    res.status(200).send({
      success: false,
    });

    return
  }

  // transfer nft to bidder
  const signature = await transferNFT(auction.nftAddress, req.body.bidder)
  console.log(signature)

  if (!signature) {
    res.status(200).send({
      success: false,
    });

    return
  }

  // set the winner
  await bidderModel.updateOne(
    {
      auctionId: new ObjectId(req.body.auctionId),
      userWallet: req.body.bidder,
    },
    {
      $set: {
        isWinner: true,
      }
    }
  );

  // refund the tokens to losers
  const losers = await bidderModel.find({
    auctionId: new ObjectId(req.body.auctionId),
    isWinner: false,
  });

  for (let i = 0; i < losers.length; i++) {
    await userModel.updateOne(
      {
        userWallet: losers[i].userWallet,
      },
      {
        $inc: { tokenAmount: losers[i].bidPrice },
      }
    );
  }

  // close the auction
  await auctionModel.updateOne(
    {
      _id: new ObjectId(req.body.auctionId),
    },
    {
      $set: { isEnd: true },
    }
  );

  res.status(200).send({
    success: true,
  });
})