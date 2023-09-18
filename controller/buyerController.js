const express = require('express')
const models = require('../models/index.js')


const getContractList = async(req,res) =>{
    try{
         let contractLists =  await models.MarketMakerContract.findAll({
            where:{
                buyAvailable:true,
                status:"inprocess"
            },
            attributes:['id','strikePrice','premium','openInterest','expirationDate','contractAddress']
         })
         res.status(200).json({contractLists})   
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

const buyContract  = async(req,res) =>{
    try{
        if(!req.body.contractId || !req.body.txAmount || !req.body.userWalletAddress){
             throw new Error("Provide valid inputs.")   
        }

        //check if user is prtesent
        let user =await models.User.findOne({
            where:{walletAddress:req.body.userWalletAddress}})

        //if not create new user entry
        if(!user){
            user = await models.User.create({walletAddress:req.body.userWalletAddress})
        }
        console.log("log1")
        //create a new transaction
        let transaction =  await models.Transaction.create({userId:user.userId,txType:'buy',txAmount:req.body.txAmount})
        console.log("log2")
        //check if contract is present
        let contract = await models.MarketMakerContract.findOne({
            where:{id:req.body.contractId}})        
            console.log("log3")    
        //if contract not present give error
        if(!contract){
            throw new Error("Contract is not present.")
        }

        //if contract present then update contract
        let updateContractData = {
            ownerId: user.userId,
            txId:transaction.txId,
            buyAvailable:false
        }
        await models.MarketMakerContract.update(updateContractData,{
            where:{
            id:req.body.contractId
            }
        })

        res.status(200).send("success")

    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

module.exports ={
    getContractList,
    buyContract
}