const express = require('express')
const models = require('../models/index.js')


const getContractList = async(req,res) =>{
    try{
        if(!req.body.contractType){
            throw new Error("Invalid input parameters.")
        }

         let contractLists =  await models.MoneyMakerContract.findAll({
            where:{
                buyAvailable:true,
                status:"inprocess",
                contractType:req.body.contractType
            },
            attributes:['id','strikePrice','premium','openInterest','expirationDate','contractAddress','quantity','currency','title','buyer','seller','governingLaw','propertyAddress','sellingPrice','terms','contractType']
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
        let contract = await models.MoneyMakerContract.findOne({
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
        await models.MoneyMakerContract.update(updateContractData,{
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

const registerNewBuyer = async(req,res)=>{
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
        if(!req.body.contractType || !req.body.contractstatus || !req.body.walletAddress){
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
                contractList= await models.MoneyMakerContract.findAll({
                    where:{
                        ownerId:user.userId,
                        contractType:req.body.contractType
                    }
                })
            }
            else{
                if(req.body.contractstatus==='inactive'){
                    req.body.contractstatus = ['processedWithAboveStrikePrice','processedWithBelowStrikePrice']
                }
                

                contractList= await models.MoneyMakerContract.findAll({
                    where:{
                        ownerId:user.userId,
                        contractType:req.body.contractType,
                        status: req.body.contractstatus
                    }
                })
            }
        // }
        
        res.status(200).json({contractType:req.body.contractType,contractList})
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
    registerNewBuyer
}