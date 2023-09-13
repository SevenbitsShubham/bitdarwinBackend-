const express = require('express')
const router = express.Router()
const moneyMakerController = require('../controller/moneyMakerController.js')


router.get('/test',(req,res)=>{
    res.status(200).send("Test api")
})

router.post('/moneyMaker/createContract',moneyMakerController.createContract)
router.get('/prediction/btcPrice',moneyMakerController.pricePredictor)

module.exports = router