const express = require('express')
const {Op} = require('sequelize')
const models = require('../models/index.js')
const icpMethods = require('../helper/icpMethods.js')
const dotenv = require("dotenv").config().parsed;
const BN = require("bignumber.js")
const {validateDepositTx,sendTransaction,validateTx} = require('../helper/txValidationHelper.js')


const getContractList = async(req,res) =>{
    try{
        if(!req.body.contractType || !req.body.walletAddress){
            throw new Error("Invalid input parameters.")
        }

        let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress
            }
        })

        if(!user){
            throw new Error("User is not registered.")
        }
         let contractLists =  await models.MoneyMakerContract.findAll({
            where:{
                buyAvailable:true,
                status:["inprocess","inprocess-resell"],
                createrId: {
                    [Op.ne]:user.userId
                },
                ownerId: {
                    [Op.ne]:user.userId
                },
                contractType:req.body.contractType
            },
            attributes:['id','strikePrice','premium','openInterest','expirationDate','contractAddress','quantity','currency','title','buyer','seller','governingLaw','propertyAddress','sellingPrice','terms','contractType','deployment']
         })
         res.status(200).json({contractLists})   
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

//add transaction to this function 
//validate transaction given by user
const buyContract  = async(req,res) =>{
    try{
        // await models.sequelize.transaction(async (transaction) =>{
        if(!req.body.contractAddress || !req.body.txHash || !req.body.userWalletAddress){
             throw new Error("Provide valid inputs.")   
        }

        //check if user is prtesent
        let user =await models.User.findOne({
            where:{walletAddress:req.body.userWalletAddress}} )

        //if not create new user entry
        if(!user){
            user = await models.User.create({walletAddress:req.body.userWalletAddress})
        }

        //check if contract is present
        let contract = await models.MoneyMakerContract.findOne({
            where:{contractAddress:req.body.contractAddress},
            include:[{
                model: models.User,
                as: 'OwnerId',
                attributes:['walletAddress']
            }]
        })

        //validate input parameters for icp 
        if(contract.deployment === 'ICP'){
            if(!req.body.icpLoginHash ){
                throw new Error("Icp Login Hash is required.")
            }

            if(!req.body.signForIcpAuth){
                throw new Error("Icp auth signature is required.")
            }
        }

        //added tx validation
        let txStatus =  await validateDepositTx(req.body.txHash)

        if(txStatus.status !== 'Success'){
            throw new Error(`Transaction is ${txStatus}.`)
        }

        let sentQuantity = (new BN(txStatus.amount).dividedBy(new BN(process.env.USDC_Decimals))).toNumber().toPrecision(2)
        let reqPremium = parseFloat(contract.premium)
        // console.log("quantValidation",sentQuantity,reqPremium)
        if(reqPremium !== parseFloat(sentQuantity)){
            throw new Error(`Inavlid transaction amount.`)
        }

        //create a new transaction
        let newTx =  await models.Transaction.create({userId:user.userId,txType:'buy',txAmount:req.body.txAmount})

        //if contract not present give error
        if(!contract){
            throw new Error("Contract is not present.")
        }

        if(contract.ownerId === user.userId){
            throw new Error("Contract is already owned by buyer can't buy contract.")
        }

        if(contract.createrId === user.userId){
            throw new Error("User is the creater of the contract.User can't buy contract.")
        }

        if(contract.deployment === 'ICP'){
            await icpMethods.buyIcpContract(contract.contractAddress,contract.OwnerId.walletAddress,user.walletAddress,req.body)
           } 

        //if contract present then update contract
        let updateContractData 
        if(contract.deployment === 'ICP'){   
            updateContractData = {
                ownerId: user.userId,
                txId:newTx.txId,
                buyAvailable:false,
                icpAuthSignature:req.body.signForIcpAuth,
                icpAuthString:req.body.icpLoginHash,
                status: 'inprocess'
            }
        }
        else{    
            updateContractData= {
                ownerId: user.userId,
                txId:newTx.txId,
                buyAvailable:false,
                status: 'inprocess'
            }
        }    
        await models.MoneyMakerContract.update(updateContractData,{
            where:{
                contractAddress:req.body.contractAddress
            }
        })

        res.status(200).send("success")
    //   })
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const checkUserRegistration = async(req,res)=>{
   try{
        if(!req.body.walletAddress){
            throw new Error("Please provide valid inputs.")
        }

        let user = await models.User.findOne({
            where:{
                walletAddress: req.body.walletAddress 
            }
        })
        
        if(!user){
            await models.User.create({
                walletAddress: req.body.walletAddress 
            })
            res.status(200).send("Success")            
        }
        else{
            res.status(200).send("User already present")            
        }
   }
   catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
   }  
}


const getBuyerContracts = async(req,res) =>{
    try{
        if( !req.body.contractstatus || !req.body.walletAddress){
            throw new Error("Enter valid inputs.")
        }

        let user= await models.User.findOne({
            where:{
                walletAddress:req.body.walletAddress
            }
        })

        //if user is not present throw errror
        if(!user){
            throw new Error("User is not present.")
        }

        let contractList =[]
        //get contract list 
        // if(req.body.contractType === 'MoneyMaker'){
            if(req.body.contractstatus === 'all'){
                req.body.contractstatus = ['inprocess','inprocess-resell','processedWithAboveStrikePrice','processingWithAboveStrikePrice','processedWithBelowStrikePrice']
            }
            else{
                if(req.body.contractstatus==='inactive'){
                    req.body.contractstatus = ['processedWithAboveStrikePrice','processingWithAboveStrikePrice','processedWithBelowStrikePrice']
                }
                else{
                    req.body.contractstatus = ['inprocess','inprocess-resell']
                }
            }

            contractList= await models.MoneyMakerContract.findAll({
                where:{
                    ownerId:user.userId,
                    status: req.body.contractstatus
                    // contractType:req.body.contractType
                },
                include:[{
                    model: models.User,
                    as: 'OwnerId',
                    attributes:['walletAddress']
                },{
                    
                    model: models.User,
                    as: 'CreaterId',
                    attributes:['walletAddress']
                }]
            })
        // }
        
        res.status(200).json({contractStatus:req.body.contractstatus,contractList} )
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const contractResell = async(req,res) =>{
    try{
        //input validation for contract address
       if(!req.body.contractAddress || !req.body.walletAddress){
           throw new Error("Please provide valid inputs.") 
       } 

       //get contract info
       let contract = await models.MoneyMakerContract.findOne({
            where:{
                contractAddress: req.body.contractAddress
            },
            include:[{
                model: models.User,
                as: 'OwnerId'
            },{
                
                model: models.User,
                as: 'CreaterId'
            }
        ]
       })


       //check if contract is valid
       if(!contract){
           throw new Error("Invalid contract.") 
       }

       //check whether user is owner of the contract
       if(req.body.walletAddress !== contract.OwnerId.walletAddress){
           throw new Error("Unable to resell. As user is not the owner of the contract.") 
       }

       //check whether user is owner of the contract
       if(req.body.walletAddress === contract.CreaterId.walletAddress){
        throw new Error("Unable to resell.As user is the creator of the contract.") 
    }

       //check if contract is not expired
       if(contract.status !== 'inprocess'){
        throw new Error("Contract is unavailable for resell.") 
        }
       //change buyAvailable value in contract
       await models.MoneyMakerContract.update({
            buyAvailable:1,
            status: 'inprocess-resell'
       },{
        where:{
            contractAddress: req.body.contractAddress            
        }
       }) 

       res.status(200).send("success")
       
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const buyLockedBTC = async(req,res) =>{
    try{
        // await models.sequelize.transaction(async (transaction) =>{
        
            //input validation
            if(!req.body.contractAddress || !req.body.txHash || !req.body.userAddress){
                throw new Error("Valid inputs are required.")
            }

            let tx = await models.Transaction.findOne({
                where:{
                    txHash: req.body.txHash
                }
            })

            if(tx){
                throw new Error("Transaction is already present in the system.")
            }

            //check if contract exists
            let callOptionContract = await models.MoneyMakerContract.findOne({
                where:{
                    contractAddress: req.body.contractAddress
                },
                include:[{
                    model: models.User,
                    as: 'OwnerId',
                    attributes:['walletAddress','balance']
                }]
            })

            if(!callOptionContract){
                throw new Error("Contract doesn't exist.")
            }

            //check if contract is call option or not
            if(callOptionContract.contractType !== "MoneyMaker"){
                throw new Error("Invalid operation on the contract,contract must be call option contract.")
            }

            //check if contract has valid status
            if(callOptionContract.status !== 'processingWithAboveStrikePrice'){
                throw new Error('Invalid contract status.')
            }

            console.log("buyBTCLog",callOptionContract)
            //check if user exists
            let user = await models.User.findOne({
                where:{
                    walletAddress: req.body.userAddress
                }
            })

            //check if user ownership exists 
            if(callOptionContract.OwnerId.walletAddress !== req.body.userAddress){
                throw new Error('User is not the owner of the contract.')
            }
            
            //validate tx
            let txStatus =  await validateDepositTx(req.body.txHash)

            if(txStatus.status !== 'Success'){
                throw new Error(`Transaction is ${txStatus}.`)
            }

            //check transaction amount and validate--pending
            let sentQuantity = (new BN(txStatus.amount).dividedBy(new BN(process.env.USDC_Decimals))).toNumber().toPrecision(2)
            let reqUsdcQuuantity = (new BN(callOptionContract.quantity).multipliedBy(new BN(callOptionContract.strikePrice))).toNumber().toPrecision(2)
            // console.log("quantValidation",sentQuantity,reqUsdcQuuantity)
            if(reqUsdcQuuantity !== sentQuantity){
                throw new Error(`Inavlid transaction amount.`)
            }

            //add USDC transaction to transaction table
            await models.Transaction.create({
                userId: user.userId,
                contractId: callOptionContract.id,
                txType:'processedWithAboveStrikePriceTxUSDC',
                txAmount:sentQuantity,
                txHash:req.body.txHash,
                fees:0,
                status: "Success"
            })
             
            let amountinBTC
            let statusObj ={}
            if(callOptionContract.deployment === "ICP"){
                //getting contract details from icp
                let contractDetails = await icpMethods.getOptionContract(callOptionContract.contractAddress)
                //validating if userAddress is buyer 
                if(contractDetails.holder !== req.body.userAddress){
                    throw new Error("Given user address is not the owner of the contract.")
                }
                let poolAddress =await icpMethods.getCanisterPoolAddress()
                let poolBalance = await icpMethods.getPoolBalance(poolAddress)
                let reqPoolBalance=new BN(poolBalance).dividedBy(dotenv.TBTC_Decimal).toString()
                let reqAmount = new BN(contractDetails.btc_quantity).dividedBy(dotenv.TBTC_Decimal).toString()
                console.log("balanceLog",reqPoolBalance,reqAmount)
                if(reqPoolBalance < reqAmount){
                    throw new Error("Internal Error")
                }
                let txHash =  await icpMethods.expireIcpContractForOwner(callOptionContract.contractAddress,callOptionContract.icpAuthSignature,callOptionContract.icpAuthString)
                statusObj.status = "Success"
                statusObj.quantity = callOptionContract.quantity
                statusObj.TransactionHash = txHash
            }
            else{
                //transfer the BTC amount
                amountinBTC = callOptionContract.quantity
                statusObj =  await sendTransaction(dotenv.TBTC_UserPoolAddress, amountinBTC, dotenv.TBTC_HotWalletId, dotenv.TBTC_encryptedString, dotenv.TBTC_walletPassphrase)
            }
       
            

            console.log("statusObj",statusObj)
            if(statusObj.status === "Success"){
                let newBalance = (new BN(user.balance)).plus(new BN(statusObj.quantity)).toPrecision(8)
                await models.User.update({balance : newBalance},{
                    where:{
                        walletAddress: req.body.userAddress
                    }
                })
                console.log("balanceUpdate",user.balance,newBalance)
                //add btc transaction to transaction table
                await models.Transaction.create({
                    userId: user.userId,
                    contractId: callOptionContract.id,
                    txType:'processedWithAboveStrikePriceTxBTC',
                    txAmount:statusObj.quantity,
                    txHash:statusObj.TransactionHash,
                    fees:0,
                    status: statusObj.status
                })

                //update status of the contract
                await models.MoneyMakerContract.update({
                    status:"processedWithBelowStrikePrice"
                },{where:
                    {id: callOptionContract.id}
                })
            res.status(200).send({status:"Success",txHash:statusObj.TransactionHash})
            }
            else{
                throw new Error(`BTC transfer transaction is ${txStatus}.`)
            }

        // })
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

module.exports ={
    getContractList,
    buyContract,
    getBuyerContracts,
    checkUserRegistration,
    contractResell,
    buyLockedBTC
}