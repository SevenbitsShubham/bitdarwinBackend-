const express = require('express')
const router = express.Router()
const moneyMakerController = require('../controller/moneyMakerController.js')
const buyerController = require('../controller/buyerController.js')

router.get('/test',(req,res)=>{
    res.status(200).send("Test api")
})

//moneymaker routes
router.post('/moneyMaker/createContract',moneyMakerController.createContract)
router.get('/prediction/btcPrice',moneyMakerController.pricePredictor)
router.get('/moneyMaker/getPoolAddress',moneyMakerController.getPoolAddress)
router.get('/moneyMaker/walletBalance',moneyMakerController.getWalletBalance)

//buyer and explorer routes
router.get('/buyer/contract/list',buyerController.getContractList)
router.post('/buyer/buy',buyerController.buyContract)
router.post('/buyer/ownerContractList',buyerController.getBuyerContracts)
router.post('/buyer/register',buyerController.registerNewBuyer)

module.exports = router