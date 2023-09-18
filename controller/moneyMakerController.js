const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
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

module.exports = {
    createContract,
    pricePredictor,
    getPoolAddress
}