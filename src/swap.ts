import axios from "axios";
import bs58 from "bs58";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

//  Load wallet from secret key
const phantomBase58Key = ""; // Add your base58 private key here
const secretKeyUint8Array = bs58.decode(phantomBase58Key);
const wallet = Keypair.fromSecretKey(secretKeyUint8Array);

// Token mint addresses
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); 
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112"); 

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed")

async function main() {
  try {
    //  Find ATA for USDC
    const merchantUSDCTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      wallet.publicKey,
      false
    );

    console.log("Merchant USDC ATA:", merchantUSDCTokenAccount.toBase58());

    // Get quote
    const quoteResponse = await axios.get("https://quote-api.jup.ag/v6/quote", {
      params: {
        inputMint: SOL_MINT.toBase58(),
        outputMint: USDC_MINT.toBase58(),
        amount: 100000, // 0.0001 SOL
        slippageBps: 50, // 0.5% slippage
        onlyDirectRoutes: false, // Allow better routes
      },
    });

    console.log("Quote:", quoteResponse.data);

    //  Get swap transaction
    const swapResponse = await axios.post("https://quote-api.jup.ag/v6/swap", {
      quoteResponse: quoteResponse.data,
      userPublicKey: wallet.publicKey.toBase58(),
      destinationTokenAccount: merchantUSDCTokenAccount.toBase58(),
      wrapAndUnwrapSol: true, // Automatically handle SOL wrapping
      dynamicComputeUnitLimit: true, // Optimize compute units
      prioritizationFeeLamports: 100000, // Add priority fee
    });

    //  transaction
    const swapTransactionBuf = Buffer.from(
      swapResponse.data.swapTransaction,
      "base64"
    );
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    //  Sign & send
    transaction.sign([wallet]);

    const rawTransaction = transaction.serialize();
    const transactionId = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false, // Enable preflight
      maxRetries: 2,
    });

    //  Confirm transaction
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: transactionId,
    });

    console.log(
      `Transaction confirmed: https://solscan.io/tx/${transactionId}`
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
