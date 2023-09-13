const express = require('express')
const models = require('../models/index.js')
const { spawnSync } = require('child_process');
// const Chroma = require('langchain/vectorstores/chroma')
// const OpenAIEmbeddings = require('langchain/embeddings/openai')


const createContract = async(req,res) =>{
        try{
            if(!req.body.strikePrice || !req.body.premium || !req.body.openInterest || !req.body.expirationDate || !req.body.query || !req.body.signature){
                 throw new Error("Valid parameters are required.")   
            }

            
            let newContract = {
                strikePrice:req.body.strikePrice,
                premium:req.body.premium,
                openInterest:req.body.openInterest,
                expirationDate:req.body.expirationDate,
                status: 'inProcess',
                query:req.body.query,
                signature:req.body.signature,
                contractAddress:null
            }

            await models.MarketMakerContract.create(newContract)
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