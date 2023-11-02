const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
const BN = require("bignumber.js")
const BitGo = require('bitgo');
const dotenv = require("dotenv").config().parsed;
const bitgo = new BitGo.BitGo({accessToken:dotenv.BITGO_AccessToken}); // defaults to testnet. add env: 'prod' if you want to go against mainnet
const Web3 = require('web3')
const icpMethods = require('../helper/icpMethods.js')

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

let web3 = new Web3(`https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`)  

const createContract = async(req,res) =>{
        try{
            //initial parameter validation
            if(!req.body.walletAddress || !req.body.expirationDate || !req.body.query || !req.body.hex || !req.body.signature || !req.body.contractType ){
                 throw new Error("Valid parameters are required.")   
            }

            //find user in db
            let user =  await models.User.findOne({
               where:{     
                walletAddress:req.body.walletAddress
               }
            })

            //if user not found add user in db
            if(!user){
                user =  await models.User.create({walletAddress:req.body.walletAddress})
            }

            //if found add transaction details
            let transactionData
            let poolTxStatus
            let contractData
            
            let newContractAddress
            let lastContract = await models.MoneyMakerContract.findAll({
                limit:1,
                order:[['createdAt', 'DESC']]
            })
            let newContractId = lastContract? +lastContract[0].id+1:1
            newContractAddress =  `0xt${newContractId}xxxxxxxx${newContractId*10}`

            if(req.body.contractType === 'MoneyMaker'){
                
               if(req.body.deployment === 'ICP'){
                newContractAddress = await icpMethods.createIcpContract(req.body)
               } 

            /*****need to change below flow */   
            //    else{
            //     let lastContract = await models.MoneyMakerContract.findAll({
            //         limit:1,
            //         order:[['createdAt', 'DESC']]
            //     })
            //     let newContractId = lastContract? +lastContract[0].id+1:1
            //     newContractAddress =  `0xt${newContractId}xxxxxxxx${newContractId*10}`
            //    }


               if(!req.body.txHash){
                    throw new Error("TxHash is required.")
               }

               let reqTx = await models.Transaction.findOne({
                where:{
                    txHash: req.body.txHash
                }
               })

               if(reqTx.contractId){
                   throw new Error("Deposit transaction for the contract is already used, invalid deposit transaction.") 
               }

               
            
            //add contract details
                 contractData = {
                    ownerId: user.userId,
                    createrId: user.userId,
                    strikePrice:req.body.strikePrice,
                    premium:0.005,//req.body.premium
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
                    contractAddress:newContractAddress,
                    contract:req.body.contract
                } 
            }
            
            let newContract= await models.MoneyMakerContract.create(contractData)
            
            if(req.body.contractType === 'MoneyMaker'){
                    await models.Transaction.update({
                        contractId:newContract.id
                    },{
                        where:{txHash: req.body.txHash}
                    })
    
                    transactionData = {
                        userId:user.userId,
                        contractId:newContract.id,
                        sqlQuery:req.body.query,
                        queryHex:req.body.hex,
                        signature:req.body.signature,
                        txType: 'MoneyMaker' 
                    }
                }
                else{
                    poolTxStatus = null
                    transactionData = {
                        userId:user.userId,
                        contractId:newContract.id,
                        sqlQuery:req.body.query,
                        queryHex:req.body.hex,
                        signature:req.body.signature,
                        txType: 'HousingContract'
                    }
                }
            await models.Transaction.create(transactionData)

            res.status(200).send('Success')        

        }
        catch(error){
            console.log("error",error)
            res.status(500).send(error.message)
        }
}


const getWalletBalance = async(req,res) =>{
    try{
        if(!req.body.walletAddress){
            throw new Error("WalletAddress is required.")
        }

        let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress 
            }
        })

        if(!user){
            throw new Error("user is not registered.")
        }

        res.status(200).json({walletBalance:user.balance})
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const pricePredictor = async(req,res) =>{
    try{
        
        // const predictionScript = spawn('python',["../utils/prediction.py"])
        const predictionScript = spawnSync('python3',["../bitdarwinBackend-/utils/prediction.py","prediction",'../bitdarwinBackend-/utils/BTC-USD-price.csv'])
        let result= predictionScript.stdout?.toString()?.trim();
        const error = predictionScript.stderr?.toString()?.trim();


        if(error){
            throw new Error(error)
        }

        let filepath = '../bitdarwinBackend-/plot.png'
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
        res.status(200).json({poolAddress:process.env.WBTC_UserPoolAddress})
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

                let txStatus= await validateTx(sendTransaction.txid,amount,walletId,process.env.WBTC_PoolAddress)
                // console.log("debug7",txStatus)
                

                let payload = {
                    TransactionHash: sendTransaction.txid,
                    status: txStatus
                }
                return payload
            } catch (error) {
                console.log(error)
            }
        }
    
    catch (error) {
        console.log(error)
    }
}

const poolTransfer = async(req,res) =>{
    try{
        //validateInput 
        if(!req.body.walletAddress || !req.body.currency || !req.body.quantity){
            throw new Error('Please enter valid inputs.')
        }

        //check user is registered or not
       let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress    
            }
        })

        //if not registered throw error
        if(!user){
                throw new Error("user is not present.")
        }

        //get wallet balance of the user
        let wallet = await bitgo.coin(dotenv.WBTC_Coin).wallets().get({ id: dotenv.WBTC_UserWalletId });

        //check if the lock amount is greater than the balance
        if(req.body.quantity > parseFloat(user.balance)){
            return res.status(400).send("Low wallet balance.")
        }

        //executing and validating the tx
        poolTxStatus = await sendTransaction(dotenv.WBTC_PoolAddress, parseFloat(req.body.quantity)+0.0002, dotenv.WBTC_UserWalletId, dotenv.WBTC_UserEncryptedString, dotenv.WBTC_UserWalletPassphrase)

        if(poolTxStatus.status === "Success"){
            let newBalance = (new BN(user.balance)).minus(new BN(req.body.quantity)).toPrecision(8)
            await models.User.update({balance : newBalance},{
                where:{
                    walletAddress: req.body.walletAddress
                }
            })
        }

        //adding tx to the table
        let newTx =  await models.Transaction.create({
            userId: user.userId,
            txType:'poolTransfer',
            txAmount:req.body.quantity,
            txHash:poolTxStatus.TransactionHash,
            fees:0.0002,
            status: poolTxStatus.status
           })
        
           

        res.status(200).json(poolTxStatus)

    }
    catch (error) {
        console.log(error)
    }
}


const validateTx = async(txHash,quantity=null,userWalletAddress=null,recieverAddreess=process.env.WBTC_UserPoolAddress) =>{
        return await new Promise((resolve,reject)=>{
            let count =1
            let txInterval = setInterval(async()=>{
                let result= await web3.eth.getTransactionReceipt(txHash)     
                
                if(result?.status){
                console.log('result',result,count,result.from.toString(), userWalletAddress.toString(),result.to,recieverAddreess )
                    if(userWalletAddress){
                        // console.log("debug67",result.from ,userWalletAddress ,result.to ,recieverAddreess)
                        //for contract creation from : 0xf58e7f435c2df7d671bc8dd610f36eade19a3c96 to:0x7de01d5f2bef56bdfb9971a270ecd13cac287799
                        //for balance from: to:0xd4bccebe77b7c1da89818f8889e3ea09046e7e38 
                        // if(result.to === '0xd4bccebe77b7c1da89818f8889e3ea09046e7e38'){ //&& result.to === recieverAddreess
                        //     resolve('Success')
                        // }
                        // else{
                        //     resolve('Failed')
                        // }
                        resolve('Success')
                    }
                    else{
                        resolve('Success')
                    }
                    clearInterval(txInterval)
                }

                if(count === 6 ){
                    resolve('Pending') 
                    clearInterval(txInterval)
                }

                count++                        
            },10000)                    
        })  
    
}

const validateOffPortalTx = async(req,res) =>{
    try{
        //validateInput 
       if(!req.body.walletAddress || !req.body.userWalletAddress || !req.body.txHash || !req.body.quantity){
            throw new Error("Please provide valid inputs.")
       } 

       //check user is registered or not
       let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress    
            }
       })

       //if not registered throw error
       if(!user){
            throw new Error("user is not present.")
       }

       //check if txHash is already present or not
       let tx = await models.Transaction.findOne({
        where:{
            txHash: req.body.txHash
        }
       })

       //if tx is present throw error
       if(tx){
           throw new Error("Transaction is already present in the system.") 
       }

        //check the status of the tx       
       let txStatus = await validateTx(req.body.txHash,req.body.quantity,req.body.userWalletAddress)

       if(txStatus === "Success"){
        let newBalance = (new BN(user.balance)).plus(new BN(req.body.quantity)).toPrecision(8)
        console.log("log62",newBalance,user.balance,req.body.quantity)
        await models.User.update({balance : newBalance},{
            where:{
                walletAddress: req.body.walletAddress
            }
        })
       }

       //create a new entry of the tx
       let newTx =  await models.Transaction.create({
        userId: user.userId,
        txType:'poolTransfer',
        txAmount:req.body.quantity,
        txHash:req.body.txHash,
        status: txStatus
       })

       console.log("debug10",txStatus)

       if(txStatus === 'Success' || txStatus === 'Pending'){
            res.status(200).json({txStatus,txHash: newTx.txHash})
       }
       else{
        res.status(400).json({txStatus})
       }

    }
    catch (error) {
        console.log(error)
        res.status(500).send(error.message)
    }
}

const confirmTx = async(req,res) =>{
    try{
        //validate walletAddress and txHash inputs   
        if(!req.body.userWalletAddress || !req.body.txHash){
            throw new Error("Valid inputs are required.")
        }     

        //check if user is present
        let user = await models.User.findOne({
            where:{
                walletAddress: req.body.userWalletAddress
            }
        })

        if(!user){
            throw new Error("Invalid user..")
        }

        //get tx using txHash also associate user
        let tx = await models.Transaction.findOne({
            where:{
                txHash: req.body.txHash
            },
            include:[{model: models.User}]
        })
        console.log("debug123",tx)

        //validate tx 
        if(!tx){
            throw new Error("Please validate the tx.")
        }

        //validate user of the tx    
        if(tx.User.walletAddress !== req.body.userWalletAddress){
            throw new Error("Transaction doesn't belongs to this user.")
        }

        //validatetx.txType === 'poolTransfer' or check if contractId is valid 
        if(tx.txType !== "poolTransfer" || tx.contractId){
            throw new Error("Transaction is already used for another contract.")
        }

        res.status(200).send("Success.")

    }
    catch (error) {
        console.log(error)
        res.status(500).send(error.message)
    }
}

const depositFees = async(req,res) =>{
    try{
        //check input params (userWalletAddres)
        if(!req.body.userWalletAddress){
            throw new Error("Valid inputs are required.")
        }

        //check if user exists
        let user = await models.User.findOne({
            where:{
                walletAddress:req.body.userWalletAddress
            }
        })

        if(!user){
            throw new Error("User is not registered.")
        }

        let fees = 0.0002

        //get balance of the user
        let wallet = await bitgo.coin(dotenv.WBTC_Coin).wallets().get({ id: dotenv.WBTC_UserWalletId });
        let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.WBTC_Decimal)

        //check if balance of the user is less that 0.0002BTC fees
        if(fees > parseFloat(walletBalance)){
            return res.status(400).send("Low wallet balance.")
        }

        //transfer amount and validate the transaction
        poolTxStatus = await sendTransaction(dotenv.WBTC_PoolAddress, fees, dotenv.WBTC_UserWalletId, dotenv.WBTC_UserEncryptedString, dotenv.WBTC_UserWalletPassphrase)

        res.status(200).json(poolTxStatus)

    }
    catch(error){
        console.log(error)
        res.status(500).send(error.message)  
    }
}

module.exports = {
    createContract,
    pricePredictor,
    getPoolAddress,
    checkStrikePrice,
    getWalletBalance,
    poolTransfer,
    validateOffPortalTx,
    confirmTx,
    depositFees
}