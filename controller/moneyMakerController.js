const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
const BN = require("bignumber.js")
const BitGo = require('bitgo');
const dotenv = require("dotenv").config().parsed;
const bitgo = new BitGo.BitGo({accessToken:dotenv.BITGO_AccessToken}); // defaults to testnet. add env: 'prod' if you want to go against mainnet
const Web3 = require('web3')
const icpMethods = require('../helper/icpMethods.js')
const {validateDepositTx,sendTransaction,validateTx} = require('../helper/txValidationHelper.js')

const CoinMarketCap = require('coinmarketcap-api')
const client = new CoinMarketCap(dotenv.COINMARKETCAP_ApiKey);

const cloudinary = require('cloudinary').v2
const fs = require("fs")

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
  });

let web3 = new Web3(`https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`)  

//************************* */
const createContract = async(req,res) =>{
        try{

            // await models.sequelize.transaction(async(transaction)=>{ 

            //initial parameter validation
            if(!req.body.walletAddress || !req.body.expirationDate || !req.body.query || !req.body.hex || !req.body.signature || !req.body.contractType  ){
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
            //create a contract address if the deployment is with bitgo
            if(req.body.deployment !== 'ICP'){
                let lastContract = await models.MoneyMakerContract.findAll({
                    limit:1,
                    order:[['createdAt', 'DESC']]
                })
                let newContractId = lastContract? +lastContract[0].id+1:1
                newContractAddress =  `0xt${newContractId}xxxxxxxx${newContractId*10}`
            }
                
            if(req.body.contractType === 'MoneyMaker'){
                
               if(req.body.deployment === 'ICP'){
                newContractAddress = await icpMethods.createIcpContract(req.body)
               } 

               if(!req.body.txHash){
                    throw new Error("TxHash is required.")
               }

               let reqTx = await models.Transaction.findOne({
                where:{
                    txHash: req.body.txHash
                }
               })

               if(!reqTx){
                throw new Error("Transaction hash is not valid.") 
               }
            
            //    if(reqTx.contractId){
            //        throw new Error("Deposit transaction for the contract is already used, invalid deposit transaction.") 
            //    }
            
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
                    status: 'inprocess',   
                    buyAvailable:true,
                    contractType:req.body.contractType,
                    contractAddress:newContractAddress,
                    icpAuthSignature:req.body.icpAuthSignature,
                    icpAuthString:req.body.icpAuthString
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
                    buyAvailable:true,
                    contractType:req.body.contractType,
                    contractAddress:newContractAddress,
                    contract:req.body.contract,
                    icpAuthSignature:req.body.icpAuthSignature,
                    icpAuthString:req.body.icpAuthString
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

            res.status(200).send({status:'Success',contractAddress:newContract.contractAddress})   
        // })     

        }
        catch(error){
            console.log("error",error)
            res.status(500).send(error.message)
        }
}


const getWalletBalance = async(req,res) =>{
    try{
        let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: dotenv.TBTC_UserWalletId });
        let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.TBTC_Decimal).toString()
        console.log("balancelog",walletBalance)
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
        if(!req.body.months){
            throw new Error("No. of months for prediction are required.")
        }

        if(isNaN(parseInt(req.body.months))){
            throw new Error("Valid No. of months for prediction are required.")
        }
        
        // const predictionScript = spawn('python',["../utils/prediction.py"])
        const predictionScript = spawnSync('python3',["../bitdarwinBackend-/utils/prediction.py","prediction",'../bitdarwinBackend-/utils/BTC-USD-current-price.csv',req.body.months])
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
                if(fs.existsSync(filepath)){
                    fs.unlinkSync(filepath)
                }
                res.status(200).json({url:result.secure_url} )
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
        res.status(200).json({poolAddress:process.env.TBTC_UserPoolAddress})
    } catch (error) {
        
    }
}

async function checkStrikePrice()  {
    let contracts =  await models.MoneyMakerContract.findAll({
        where:{
            status:"inprocess"
        }
        })
    let currentBTCPrice = await USDConverter('BTC')
    console.log("checkPriceLog",contracts.length)
    // contracts = [contracts[0]]
    for(let contract of contracts){
        
        let expirationDate = new Date(contract.dataValues.expirationDate);
        let currentTime = new Date();
        console.log(currentTime,"current time")
        console.log(expirationDate,"expiration date time")
        
        if(currentTime > expirationDate){
            console.log("currentContract",contract.id,contract.strikePrice,".........................................price",currentBTCPrice)
            if(contract.dataValues.strikePrice < currentBTCPrice){
                //failed
                await models.MoneyMakerContract.update({
                    status:"inExpirationProcess"
                },{where:
                    {id: contract.id}
                })
                let creatorUserAddress = await models.User.findOne({userId: contract.createrId})
                console.log(creatorUserAddress.walletAddress)
                let amountinBTC = contract.quantity

                let statusObj={}
                console.log("cron50")
                if(contract.deployment === "ICP"){
                    let txHash =  await icpMethods.expireIcpContractForCreator(contract.contractAddress,contract.icpAuthSignature,contract.icpAuthString)
                    console.log("cron50.5")
                    statusObj.status = "Success"
                    statusObj.quantity = contract.quantity
                    statusObj.TransactionHash = txHash
                    console.log("cron51")
                }
                else{
                    statusObj =  await sendTransaction(dotenv.TBTC_UserPoolAddress, amountinBTC, dotenv.TBTC_HotWalletId, dotenv.TBTC_encryptedString, dotenv.TBTC_walletPassphrase)
                }

                console.log("cron52")
                console.log("statusObj",statusObj)
                if(statusObj.status === "Success"){
                    let newBalance = (new BN(creatorUserAddress.balance)).plus(new BN(statusObj.quantity)).toPrecision(8)
                    await models.User.update({balance : newBalance},{
                        where:{
                            userId: contract.createrId
                        }
                    })
                    console.log("balanceUpdate",creatorUserAddress.balance,newBalance)

                    console.log("contractStatusUpdate","processedWithBelowStrikePrice")
                    await models.MoneyMakerContract.update({
                        status:"processedWithBelowStrikePrice"
                    },{where:
                        {id: contract.id}
                    })

                    await models.Transaction.create({
                        userId: contract.createrId,
                        contractId: contract.id,
                        txType:'processedWithBelowStrikePriceTx',
                        txAmount:statusObj.quantity,
                        txHash:statusObj.TransactionHash,
                        fees:0,
                        status: statusObj.status
                    })
                }
                console.log("cron59")
            }
            else{
                //success
                // let marketMakerUserAddress = await models.User.findOne({userId: contract.dataValues.userId})
                // console.log(marketMakerUserAddress.dataValues.walletAddress)
                // let amountinBTC = "0.0003"
                // await sendTransaction(marketMakerUserAddress.dataValues.walletAddress, amountinBTC, dotenv.TBTC_HotWalletId, dotenv.TBTC_encryptedString, dotenv.TBTC_walletPassphrase)
                await models.MoneyMakerContract.update({
                    status:"processingWithAboveStrikePrice"
                },{where:
                    {id: contract.id}
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


// async function sendTransaction(address, amount, walletId, encryptedString, walletPassphrase) {
//         console.log("====================================================== SENDING TBTC TO MARKETMAKERS =================================================")
//             let amountinDecimal = new BN(amount).times(dotenv.TBTC_Decimal).toFixed(0).toString()
//             console.log(amountinDecimal)
//             let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: walletId });
//             let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.TBTC_Decimal).toString()

//             console.log("txLog1",walletBalance)
//             try {

//                 let prebuild = await wallet.prebuildTransaction({
//                     recipients: [{address:address,amount:amountinDecimal}]
//                 })

//                 // console.log("txLog2",prebuild)
//                 let decryptedString = bitgo.decrypt({password: walletPassphrase, input: encryptedString }) 

//                 // console.log("txLog3",decryptedString)
//                 let signedTX = await wallet.signTransaction({ txPrebuild: prebuild, prv: decryptedString })
                
//                 // console.log("txLog4",signedTX)
//                 let sendTransaction = await wallet.submitTransaction({
//                     txHex: signedTX.txHex
//                 })

//                 // console.log("debug6",signedTX,"wallet",wallet,"sendTx",sendTransaction)

//                 let txStatus= await validateTx(wallet,sendTransaction.txid,amountinDecimal)
//                 console.log("debug7",txStatus)
//                 // let txStatus= await validateTx(wallet,sendTransaction.txid,amountinDecimal,walletId,process.env.WBTC_PoolAddress)
//                 // console.log("debug7",txStatus)
//                 let reqQuantity
//                 if(txStatus.status == "Success"){
//                     reqQuantity=new BN(txStatus.quantity).dividedBy(dotenv.TBTC_Decimal).toString()
//                 }
//                 let payload = {
//                     TransactionHash: sendTransaction.txid,
//                     status: txStatus.status,
//                     quantity:reqQuantity
//                 }
//                 return payload            
//         }
    
//     catch (error) {
//         console.log(error)
//     }
// }

const poolTransfer = async(req,res) =>{
    try{
        //validateInput 
        if(!req.body.walletAddress || !req.body.currency || !req.body.quantity || !req.body.deployment){
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
        let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: dotenv.TBTC_UserWalletId });
        let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.TBTC_Decimal)

        //check if the lock amount is greater than the balance
        if(req.body.quantity > parseFloat(user.balance)){
            throw new Error("Low wallet balance.")
        }

        let fees = parseFloat(process.env.FeeAmount)
        //executing and validating the tx
        // poolTxStatus = await sendTransaction(dotenv.TBTC_PoolAddress, parseFloat(req.body.quantity)+0.0002, dotenv.TBTC_UserWalletId, dotenv.TBTC_UserEncryptedString, dotenv.TBTC_UserWalletPassphrase)        
        if(req.body.deployment === "ICP"){
            let canisterPoolAddress = await icpMethods.getCanisterPoolAddress()
            poolTxStatus = await sendTransaction(canisterPoolAddress, parseFloat(req.body.quantity)+fees, dotenv.TBTC_UserWalletId, dotenv.TBTC_UserEncryptedString, dotenv.TBTC_UserWalletPassphrase,req.body.deployment)
        }
        else{
            poolTxStatus = await sendTransaction(dotenv.TBTC_PoolAddress, parseFloat(req.body.quantity)+fees, dotenv.TBTC_UserWalletId, dotenv.TBTC_UserEncryptedString, dotenv.TBTC_UserWalletPassphrase,req.body.deployment)
        }    
        // poolTxStatus = await sendTransaction(dotenv.WBTC_PoolAddress, (req.body.quantity+fees), dotenv.WBTC_UserWalletId, dotenv.WBTC_UserEncryptedString, dotenv.WBTC_UserWalletPassphrase)

        if(poolTxStatus.status === "Success"){
            poolTxStatus.quantity=new BN(poolTxStatus.quantity).dividedBy(new BN(dotenv.TBTC_Decimal)).minus(new BN(process.env.FeeAmount)).abs().toString()
            let newBalance = (new BN(user.balance)).minus(new BN(poolTxStatus.quantity)).toPrecision(8)
            await models.User.update({balance : newBalance},{
                where:{
                    walletAddress: req.body.walletAddress
                }
            })
        }

        //adding tx to the table
        await models.Transaction.create({
            userId: user.userId,
            txType:'poolTransfer',
            txAmount:req.body.quantity,
            txHash:poolTxStatus.TransactionHash,
            fees:fees,
            status: poolTxStatus.status
           })
        
           

        res.status(200).json(poolTxStatus)

    }
    catch (error) {
        console.log(error)
        res.status(500).send(error.message)
    }
}


// const validateTx = async(walletInstance,transactionHash,quantity=null,userWalletAddress=null,recieverAddreess=process.env.TBTC_PoolAddress) =>{
//         return await new Promise((resolve,reject)=>{
//             let count =1
//             let txInterval = setInterval(async()=>{
                
//                 let transfer = await walletInstance.getTransfer({id:transactionHash})
//                 // let result= await web3.eth.getTransactionReceipt(txHash)     
                
//                 console.log('result',transfer.state,count)
//                 if(transfer.state === "confirmed" || transfer.state === "failed" ){
//                     console.log("debug7",JSON.stringify(transfer))
//                     if(transfer.state === "confirmed"){
//                         let findAddressProof 
//                         console.log("findAddressProof",findAddressProof,quantity,transfer.baseValue)
//                         if(userWalletAddress ){
//                             // console.log("debug67",result.from ,userWalletAddress ,result.to ,recieverAddreess)
//                             // if(result.from === userWalletAddress ){ //&& result.to === recieverAddreess
//                             //     resolve('Success')
//                             // }
//                             // else{
//                             //     resolve('Failed')
//                             // }
//                             // let findAddressProof = transfer.outputs.find(element=>element.address === userWalletAddress)
//                             // console.log("findAddressProof",findAddressProof,quantity,baseValue)
//                         findAddressProof = transfer.outputs.find(element=>element.wallet === userWalletAddress)
//                         }
//                         else{
//                             // console.log("log51",Object.keys(transfer),transfer.output,process.env.TBTC_HotWalletId)
//                         findAddressProof = transfer.outputs.find(element=>{
//                             console.log("logger",element.wallet === process.env.TBTC_HotWalletId.toString(),element.wallet ,process.env.TBTC_HotWalletId.toString())
//                             if(element.wallet === process.env.TBTC_HotWalletId.toString()){
//                                 return element 
//                             }
                            
//                         })
//                         }

//                         console.log("logger2",findAddressProof,parseInt(quantity) === (-1*parseInt(transfer.baseValue)),quantity ,(-1*parseInt(transfer.baseValue)))
//                         if(parseInt(quantity) === (-1*parseInt(transfer.baseValue)) && findAddressProof){ 
//                             resolve({status:'Success',quantity})
//                         }
//                         else{
//                             resolve({status:'invalidTx',quantity})
//                         }
//                     }
//                     else if(transfer.state ==="failed"){
//                         resolve({status:'Rejected',quantity})
//                     }
//                     clearInterval(txInterval)
//                 }

//                 if(count === 120 ){
//                     resolve({status:'Pending',quantity}) 
//                     clearInterval(txInterval)
//                 }

//                 count++                        
//             },10000)                    
//         })  
    
// }

// const validateDepositTx = async(txHash,quantity=null,userWalletAddress=null,recieverAddreess=process.env.WBTC_UserPoolAddress) =>{
//     return await new Promise((resolve,reject)=>{
//         let count =1
//         let txInterval = setInterval(async()=>{
//             let result= await web3.eth.getTransactionReceipt(txHash)     
            
//             if(result?.status){
//             // console.log('result',result,count,result.from.toString(), userWalletAddress.toString(),result.to,recieverAddreess )
//                 // if(userWalletAddress){
//                     // console.log("debug67",result.from ,userWalletAddress ,result.to ,recieverAddreess)
//                     //for contract creation from : 0xf58e7f435c2df7d671bc8dd610f36eade19a3c96 to:0x7de01d5f2bef56bdfb9971a270ecd13cac287799
//                     //for balance from: to:0xd4bccebe77b7c1da89818f8889e3ea09046e7e38 
//                     // if(result.to === '0xd4bccebe77b7c1da89818f8889e3ea09046e7e38'){ //&& result.to === recieverAddreess
//                     //     resolve('Success')
//                     // }
//                     // else{
//                     //     resolve('Failed')
//                     // }
//                     resolve('Success')
//                 // }
//                 // else{
//                 //     resolve('Success')
//                 // }
//                 clearInterval(txInterval)
//             }

//             if(count === 10 ){
//                 resolve('Pending') 
//                 clearInterval(txInterval)
//             }

//             count++                        
//         },10000)                    
//     })  

// }

/***************** */
const validateOffPortalTx = async(req,res) =>{
    try{
        await models.sequelize.transaction(async(transaction)=>{

        //validateInput 
       if(!req.body.walletAddress || !req.body.txHash ){
            throw new Error("Please provide valid inputs.")
       } 

       //check user is registered or not
       let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress    
            }
       },{transaction})

       //if not registered throw error
       if(!user){
            throw new Error("user is not present.")
       }

       //check if txHash is already present or not
       let tx = await models.Transaction.findOne({
        where:{
            txHash: req.body.txHash
        }
       },{transaction})

       //if tx is present throw error
    //    if(tx){
    //        throw new Error("Transaction is already present in the system.") 
    //    }

       let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: dotenv.TBTC_UserWalletId });
       let amountinDecimal = new BN(req.body.quantity).times(dotenv.TBTC_Decimal).toString()

       //check the status of the tx       
       let txStatus = await validateTx(wallet,req.body.txHash,null,process.env.TBTC_UserPoolAddress)

       if(txStatus.status === 'error'){
        // console.log("log",txStatus.error)
        // if(txStatus.error.result.name === 'Invalid'){
            throw new Error("Please try after some time, transaction is still confirming.")
        // }
       }

       if(txStatus.status === 'failed'){
        throw new Error("Invalid transaction.")
       }

       if(txStatus.status === 'Pending'){
        throw new Error("Transaction taking too much time for validation, please try after some time.")
       }

       if(txStatus.status === "Success"){
        let reqQuantity = Math.abs(new BN(txStatus.quantity).dividedBy(dotenv.TBTC_Decimal).toString())
        console.log("reqQuantity",reqQuantity)
        let newBalance = (new BN(user.balance)).plus(new BN(reqQuantity)).toPrecision(8)
        console.log("updateBalance",user.balance,newBalance)
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
        status: txStatus.status
       },{transaction})

       console.log("debug10",txStatus)

       if(txStatus.status === 'Success'){
            res.status(200).json({...txStatus,txHash: newTx.txHash})
       }
       else{
        res.status(400).json({txStatus})
       }
     })
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

        let fees = parseFloat(process.env.FeeAmount)
        //check if user exists
        let user = await models.User.findOne({
            where:{
                walletAddress:req.body.userWalletAddress
            }
        })

        if(!user){
            throw new Error("User is not registered.")
        }

        if(parseFloat(user.balance) < parseFloat(fees)){
            throw new Error('Low wallet balance.')
        }        

        //get balance of the user
        let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: dotenv.TBTC_UserWalletId });
        // let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.TBTC_Decimal)

        //check if balance of the user is less that 0.0002BTC fees
        if(fees > parseFloat(user.balance)){
            return res.status(400).send("Low wallet balance.")
        }

        //transfer amount and validate the transaction
        poolTxStatus = await sendTransaction(dotenv.TBTC_PoolAddress, fees, dotenv.TBTC_UserWalletId, dotenv.TBTC_UserEncryptedString, dotenv.TBTC_UserWalletPassphrase)

        console.log("feeApi1",poolTxStatus)
        if(poolTxStatus.status === "Success"){
            let newBalance = (new BN(user.balance)).minus(new BN(fees)).toPrecision(8)
            await models.User.update({balance : newBalance},{
                where:{
                    walletAddress: req.body.userWalletAddress
                }
            })
        }
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