const express = require('express')
const router = express.Router()
const moneyMakerController = require('../controller/moneyMakerController.js')
const cron = require("node-cron");

// router.get('/', moneyMakerController.checkStrikePrice)


router.get('/test',(req,res)=>{
    res.status(200).send("Test api")
})

router.post('/moneyMaker/createContract',moneyMakerController.createContract)
router.get('/prediction/btcPrice',moneyMakerController.pricePredictor)
router.get('/moneyMaker/getPoolAddress',moneyMakerController.getPoolAddress)
// router.get('/', moneyMakerController.checkStrikePrice)



module.exports = router