const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
const BN = require("bignumber.js")
const BitGo = require('bitgo');
const dotenv = require("dotenv").config().parsed;
const bitgo = new BitGo.BitGo({accessToken:dotenv.BITGO_AccessToken}); // defaults to testnet. add env: 'prod' if you want to go against mainnet

const CoinMarketCap = require('coinmarketcap-api')
const client = new CoinMarketCap(dotenv.COINMARKETCAP_ApiKey);

const cloudinary = require('cloudinary').v2
const fs = require("fs")
// const Chroma = require('langchain/vectorstores/chroma')
// const OpenAIEmbeddings = require('langchain/embeddings/openai')
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
  });
  

const createContract = async(req,res) =>{
        try{
            //initial parameter validation
            if(!req.body.walletAddress || !req.body.strikePrice || !req.body.premium || !req.body.openInterest || !req.body.expirationDate || !req.body.query || !req.body.hex || !req.body.signature ){
                 throw new Error("Valid parameters are required.")   
            }

            //find user in db
            let user =  await models.User.findOne({walletAddress:req.body.walletAddress})

            //if user not found add user in db
            if(!user){
                user =  await models.User.create({walletAddress:req.body.walletAddress})
            }

            //if found add transaction details
            let transactionData = {
                userId:user.userId,
                sqlQuery:req.body.query,
                queryHex:req.body.hex,
                signature:req.body.signature,
                tyType:'moneyMaker'
            }
            let newTransaction = await models.Transaction.create(transactionData)

            //add contract details
            let contractData = {
                ownerId: user.userId,
                createrId: user.userId,
                txId: newTransaction.txId,
                strikePrice:req.body.strikePrice,
                premium:req.body.premium,
                openInterest:req.body.openInterest,
                expirationDate:req.body.expirationDate,
                status: 'inProcess',
                contractAddress:null,
                buyAvailable:true
            }                
            
            await models.MarketMakerContract.create(contractData)
            res.status(200).send('Success')        


        }
        catch(error){
            console.log("error",error)
            res.status(500).send(error.message)
        }
}

const pricePredictor = async(req,res) =>{
    try{
        
        // const predictionScript = spawn('python',["../utils/prediction.py"])
        const predictionScript = spawnSync('python3',["../backend/utils/prediction.py","prediction",'../backend/utils/BTC-USD-price.csv'])
        let result= predictionScript.stdout?.toString()?.trim();
        const error = predictionScript.stderr?.toString()?.trim();


        if(error){
            throw new Error(error)
        }

        let filepath = '../backend/plot.png'
        cloudinary.uploader.upload(filepath,(error,result)=>{
            if(error){
                throw new Error(error)
            }
            if(result){
                console.log("log1",result)
                if(fs.existsSync(filepath)){
                    fs.unlinkSync(filepath)
                }
                res.status(200).json({url:result.secure_url})
            }
        })
        
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const getPoolAddress = async(req,res) =>{
    try {
        res.status(200).json({poolAddress:process.env.POOL_ADDRESS})
    } catch (error) {
        
    }
}

async function checkStrikePrice()  {
    let contracts =  await models.MarketMakerContract.findAll({status:"inProcess"})
    let currentBTCPrice = await USDConverter('BTC')
    console.log(currentBTCPrice)
    for(let i=0;i<contracts.length;i++){
        
        let expirationDate = new Date(contracts[i].dataValues.expirationDate);
        let currentTime = new Date();
        console.log(currentTime,"current time")
        console.log(expirationDate,"expiration date time")
        
        if(currentTime > expirationDate){
            console.log(contracts[i].dataValues.strikePrice,".........................................price",currentBTCPrice)
            if(contracts[i].dataValues.strikePrice <= currentBTCPrice){
                //success
            }
            else{
                let marketMakerUserAddress = await models.User.findOne({userId: contracts[i].dataValues.userId})
                console.log(marketMakerUserAddress.dataValues.walletAddress)
                let amountinBTC = "3"
                await sendTransaction(marketMakerUserAddress.dataValues.walletAddress, amountinBTC)
            }
        }
    }
}

async function USDConverter(token) {
    try {
        let data, USD_price;
        data = await client.getQuotes({ symbol: token })
        try {
            USD_price = data.data[token].quote.USD.price;
        } catch (error) {
            token = token.toUpperCase();
            USD_price = data.data[token].quote.USD.price;
        }
        console.log(USD_price)
        return USD_price;
    } catch (error) {
        console.log(error)
        return
    }
}


async function sendTransaction(address, amount) {
    try {   
        console.log("====================================================== SENDING WBTC TO MARKETMAKERS =================================================")
        // process.exit();
            let amountinDecimal = new BN(amount).times(dotenv.WBTC_Decimal).toString()
            console.log(amountinDecimal)
            let wallet = await bitgo.coin(dotenv.WBTC_Coin).wallets().get({ id: dotenv.WBTC_HotWalletId });
            try {

                let prebuild = await wallet.prebuildTransaction({
                    recipients: [{address:address,amount:amountinDecimal}]
                })

                bitgo.unlock({ otp: '0000000' }).then(function (unlockResponse) {
                });                 

                let decryptedString = bitgo.decrypt({password: dotenv.WBTC_walletPassphrase, input: dotenv.WBTC_encryptedString }) 

                let signedTX = await wallet.signTransaction({ txPrebuild: prebuild, prv: decryptedString })
                
                let sendTransaction = await wallet.submitTransaction({
                    halfSigned: signedTX.halfSigned
                })

                let payload = {
                    Currency: dotenv.WBTC_Currency,
                    TransactionHash: sendTransaction.txid,
                }

                console.table(payload)
            
            } catch (error) {
                console.log(error)
            }
        }
    
    catch (error) {
        console.log(error)
    }
}

module.exports = {
    createContract,
    pricePredictor,
    getPoolAddress,
    checkStrikePrice
}