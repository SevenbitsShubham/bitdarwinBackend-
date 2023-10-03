const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
const BN = require("bignumber.js")
const BitGo = require('bitgo');
const dotenv = require("dotenv").config().parsed;
const bitgo = new BitGo.BitGo({accessToken:dotenv.BITGO_AccessToken}); // defaults to testnet. add env: 'prod' if you want to go against mainnet
const ic = require('ic0');

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
            if(!req.body.walletAddress || !req.body.expirationDate || !req.body.query || !req.body.hex || !req.body.signature || !req.body.contractType){
                 throw new Error("Valid parameters are required.")   
            }

            //find user in db
            let user =  await models.User.findOne({walletAddress:req.body.walletAddress})

            //if user not found add user in db
            if(!user){
                user =  await models.User.create({walletAddress:req.body.walletAddress})
            }

            //if found add transaction details
            let transactionData
            if(req.body.contractType === 'MoneyMaker'){
                transactionData = {
                    userId:user.userId,
                    sqlQuery:req.body.query,
                    queryHex:req.body.hex,
                    signature:req.body.signature,
                    txType: 'MoneyMaker' 
                }
            }
            else{
                transactionData = {
                    userId:user.userId,
                    sqlQuery:req.body.query,
                    queryHex:req.body.hex,
                    signature:req.body.signature,
                    txType: 'HousingContract'
                }
            }
            let newTransaction = await models.Transaction.create(transactionData)

            let contractData
            let newBalance
            if(req.body.contractType === 'MoneyMaker'){
                let newContractAddress
               if(req.body.deployment === 'ICP'){
                newContractAddress = await createIcpContract(req.body,'create_contract')
                console.log("debig67",newContractAddress,newContractAddress.toString())
               } 
               else{
                newContractAddress =  `0xb${(+newTransaction.txId)*100}f5ea0ba39494ce839613fffba7427****${(+newTransaction.txId)*100}`
               }
            let newBalance = +user.balance - +req.body.quantity   
            await models.User.update(
                {
                    balance: newBalance
                },
                {
                    where:{
                        walletAddress:req.body.walletAddress 
                }}
            )
            //add contract details
                 contractData = {
                    ownerId: user.userId,
                    createrId: user.userId,
                    txId: newTransaction.txId,
                    strikePrice:req.body.strikePrice,
                    premium:req.body.premium,
                    openInterest:req.body.openInterest,
                    expirationDate:req.body.expirationDate,
                    quantity:req.body.quantity,
                    currency:req.body.currency,
                    deployment:req.body.deployment,
                    status: 'inprocess',   //
                    contractAddress:null,
                    buyAvailable:true,
                    contractType:req.body.contractType,
                    contractAddress:newContractAddress //
                }                
            }
            else{
                contractData = {
                    ownerId: user.userId,
                    createrId: user.userId,
                    txId: newTransaction.txId,
                    title:req.body.title,
                    buyer:req.body.buyer,
                    seller:req.body.seller,
                    governingLaw:req.body.governingLaw,
                    propertyAddress:req.body.propertyAddress,
                    sellingPrice:req.body.sellingPrice,
                    terms:req.body.terms,
                    expirationDate:req.body.expirationDate,
                    deployment:req.body.deployment,
                    status: 'inprocess',
                    premium:10,
                    contractAddress:null,
                    buyAvailable:true,
                    contractType:req.body.contractType,
                    contractAddress:"0xb794f5ea0ba39494ce839613fffba7427****268",
                    contract:req.body.contract
                } 
            }
            // console.log("debug1",contractData)
            
            await models.MoneyMakerContract.create(contractData)
            // console.log("log",req.body.quantity)
            // await sendTransaction(dotenv.WBTC_PoolAddress, req.body.quantity, dotenv.WBTC_UserWalletId, dotenv.WBTC_UserEncryptedString, dotenv.WBTC_UserWalletPassphrase)
            res.status(200).send('Updated Balance')        


        }
        catch(error){
            console.log("error",error)
            res.status(500).send(error.message)
        }
}

const createIcpContract = async(contractParams,methodName) =>{
    let canisterId = process.env.CANISTER_ID
    let canisterInstance = ic(canisterId)
    let response = await canisterInstance.call(methodName,{strike_price:parseInt(contractParams.strikePrice), premium:parseInt(contractParams.premium), owner:contractParams.walletAddress, exercised:false, holder:contractParams.walletAddress, expiration_date:1, btc_quantity:1, open_interest:parseInt(contractParams.openInterest)})   
    console.log("response",response)
    return response
}

const getWalletBalance = async(req,res) =>{
    try{
        // let wallet = await bitgo.coin(dotenv.WBTC_Coin).wallets().get({ id: dotenv.WBTC_UserWalletId });
        // let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.WBTC_Decimal)
        if(!req.body.walletAddress){
            throw new Error("Invalid inputs.")
        }
        let reqBalance = 0
        let user =  await models.User.findOne({walletAddress:req.body.walletAddress})
        if(user){
            reqBalance=user.balance
        }
        res.status(200).json({walletBalance:reqBalance})
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
    let contracts =  await models.MoneyMakerContract.findAll({status:"inProcess"})
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
                await models.MoneyMakerContract.update({
                    status:"processedWithBelowStrikePrice"
                },{where:
                    {id: contracts[i].id}
                })
            }
            else{
                let marketMakerUserAddress = await models.User.findOne({userId: contracts[i].dataValues.userId})
                console.log(marketMakerUserAddress.dataValues.walletAddress)
                let amountinBTC = "0.0003"
                await sendTransaction(marketMakerUserAddress.dataValues.walletAddress, amountinBTC, dotenv.WBTC_HotWalletId, dotenv.WBTC_encryptedString, dotenv.WBTC_walletPassphrase)
                await models.MoneyMakerContract.update({
                    status:"processedWithAboveStrikePrice"
                },{where:
                    {id: contracts[i].id}
                })

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


async function sendTransaction(address, amount, walletId, encryptedString, walletPassphrase) {
    try {   
        console.log("====================================================== SENDING WBTC TO MARKETMAKERS =================================================")
            let amountinDecimal = new BN(amount).times(dotenv.WBTC_Decimal).toString()
            console.log(amountinDecimal)
            let wallet = await bitgo.coin(dotenv.WBTC_Coin).wallets().get({ id: walletId });
            try {

                let prebuild = await wallet.prebuildTransaction({
                    recipients: [{address:address,amount:amountinDecimal}]
                })

                // bitgo.unlock({ otp: '0000000' }).then(function (unlockResponse) {
                // });                 

                let decryptedString = bitgo.decrypt({password: walletPassphrase, input: encryptedString }) 

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
    checkStrikePrice,
    getWalletBalance
}