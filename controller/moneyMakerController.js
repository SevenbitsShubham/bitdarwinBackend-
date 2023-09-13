const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
// const Chroma = require('langchain/vectorstores/chroma')
// const OpenAIEmbeddings = require('langchain/embeddings/openai')


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
                signature:req.body.signature
            }
            let newTransaction = await models.Transaction.create(transactionData)

            //add contract details
            let contractData = {
                userId: user.userId,
                txId: newTransaction.txId,
                strikePrice:req.body.strikePrice,
                premium:req.body.premium,
                openInterest:req.body.openInterest,
                expirationDate:req.body.expirationDate,
                status: 'inProcess',
                contractAddress:null
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
        console.log("log",result,error)
    }
    catch(error){
        console.log("error",error)
        res.status(500).send(error.message)
    }
}

module.exports = {
    createContract,
    pricePredictor
}