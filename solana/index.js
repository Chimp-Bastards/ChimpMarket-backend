import web3, { LAMPORTS_PER_SOL, PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import splToken from '@solana/spl-token';
import { getParsedNftAccountsByOwner } from "@nfteyez/sol-rayz";

import ticketModel from "../models/ticket.js"

import axios from "axios";
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from "fs";

dotenv.config();
const connection = new Connection(process.env.SOLANA_RPC_HOST);
const TOKEN_METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MAX_NAME_LENGTH = 32;
const MAX_URI_LENGTH = 200;
const MAX_SYMBOL_LENGTH = 10;
const MAX_CREATOR_LEN = 32 + 1 + 1;
const MAX_CREATOR_LIMIT = 5;
const MAX_DATA_SIZE = 4 + MAX_NAME_LENGTH + 4 + MAX_SYMBOL_LENGTH + 4 + MAX_URI_LENGTH + 2 + 1 + 4 + MAX_CREATOR_LIMIT * MAX_CREATOR_LEN;
const MAX_METADATA_LEN = 1 + 32 + 32 + MAX_DATA_SIZE + 1 + 1 + 9 + 172;
const CREATOR_ARRAY_START = 1 + 32 + 32 + 4 + MAX_NAME_LENGTH + 4 + MAX_URI_LENGTH + 4 + MAX_SYMBOL_LENGTH + 2 + 1 + 4;

export const transferToken = async (srcWallet, toPubKey, amount) => {
  let signature = null;
  try {
    const fromWallet = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(srcWallet)));
    const token = await new splToken.Token(
      connection,
      new PublicKey(process.env.TOKEN_ADDRESS),
      splToken.TOKEN_PROGRAM_ID,
      fromWallet
    );
    const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey
    );
    const toTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      new PublicKey(toPubKey),
    );

    const transaction = new web3.Transaction().add(
      splToken.Token.createTransferInstruction(
        splToken.TOKEN_PROGRAM_ID,
        fromTokenAccount.address,
        toTokenAccount.address,
        fromWallet.publicKey,
        [],
        amount * 100,
      ),
    ).add(new web3.TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from("Reward token for staking"),
    }));

    signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      { commitment: 'confirmed' },
    );
  } catch (error) {
    console.log(error)
  }

  if (signature) {
    return signature
    try {
      const res = await axios.get(`https://public-api.solscan.io/transaction/${signature}`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      })
  
      console.log(res.status)
      if (res.status == 200) {
        return signature
      }
    } catch (error) {
      console.log(error)
    }
  }

  return false
}

export const transferNFT = async (srcWallet, mintAddress, toPubKey) => {
  try {
    const fromWallet = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(srcWallet)));

    const token = await new splToken.Token(
      connection,
      new PublicKey(mintAddress),
      splToken.TOKEN_PROGRAM_ID,
      fromWallet
    );

    const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey
    )

    const toTokenAccount = await token.getOrCreateAssociatedAccountInfo(
      new PublicKey(toPubKey),
    );

    const transaction = new web3.Transaction().add(
      splToken.Token.createTransferInstruction(
        splToken.TOKEN_PROGRAM_ID,
        fromTokenAccount.address,
        toTokenAccount.address,
        fromWallet.publicKey,
        [],
        1,
      ),
    ).add(new web3.TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from("Unstake NFT"),
    }));

    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      { commitment: 'confirmed' },
    );

    return signature;

  } catch (error) {
    console.log(error)
    return false;
  }
}

const getMintAddresses = async (firstCreatorAddress) => {
  const metadataAccounts = await connection.getProgramAccounts(
    TOKEN_METADATA_PROGRAM,
    {
      dataSlice: { offset: 33, length: 32 },

      filters: [
        { dataSize: MAX_METADATA_LEN },
        {
          memcmp: {
            offset: CREATOR_ARRAY_START,
            bytes: firstCreatorAddress.toBase58(),
          },
        },
      ],
    },
  );

  return metadataAccounts.map((metadataAccountInfo) => (
    bs58.encode(metadataAccountInfo.account.data)
  ));
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}