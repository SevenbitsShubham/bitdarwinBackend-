const express = require('express')
const router = express.Router()
const moneyMakerController = require('../controller/moneyMakerController.js')
const buyerController = require('../controller/buyerController.js')

router.get('/test',(req,res)=>{
    res.status(200).send("Test api")
})

router.post('/user/checkRegistration',buyerController.checkUserRegistration)

//moneymaker routes
router.post('/moneyMaker/createContract',moneyMakerController.createContract)
router.get('/prediction/btcPrice',moneyMakerController.pricePredictor)
router.get('/moneyMaker/getPoolAddress',moneyMakerController.getPoolAddress)
router.post('/moneyMaker/walletBalance',moneyMakerController.getWalletBalance)
router.post('/moneyMaker/lockAssets',moneyMakerController.poolTransfer)
router.post('/moneyMaker/validateOffPortalLockTx',moneyMakerController.validateOffPortalTx)
router.post('/moneyMaker/confirmUserTx',moneyMakerController.confirmTx)
router.post('/moneyMaker/transferFees',moneyMakerController.depositFees)


//buyer and explorer routes
router.post('/buyer/contract/list',buyerController.getContractList)
router.post('/buyer/buy',buyerController.buyContract)
router.post('/buyer/ownerContractList',buyerController.getBuyerContracts)
router.post('/buyer/resellContract',buyerController.contractResell)


module.exports = router