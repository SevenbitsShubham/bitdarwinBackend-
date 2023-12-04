const ic = require('ic0');
let canisterId = process.env.CANISTER_ID
let canisterInstance = ic(canisterId)
const BN = require("bignumber.js")
const dotenv = require("dotenv").config().parsed;

//icp method to get canister pool address
const getCanisterPoolAddress = async() =>{
    let response =  await canisterInstance.call('get_pool_address')
    // console.log("response0",response)
    return response
}

//icp method to create a icp call option contract
const createIcpContract = async(contractParams) =>{   
    let stringDate= contractParams.expirationDate 
    stringDate = stringDate.split('-')
    let reqExpDate = (new Date(stringDate[0],stringDate[1]-1,stringDate[2])).getTime()
    console.log("expDateLog",reqExpDate)
    let alteredPremium = ((new BN(contractParams.premium)).multipliedBy(new BN(1000000))).toNumber()
    let alteredQuantity =  ((new BN(contractParams.quantity)).multipliedBy(new BN(dotenv.TBTC_Decimal))).toNumber() //exercised:false, holder:contractParams.walletAddress,
    console.log("log8989",{signature:contractParams.icpAuthSignature,strike_price:parseInt(contractParams.strikePrice), premium:alteredPremium, owner:contractParams.walletAddress, message:contractParams.icpAuthString, expiration_date:reqExpDate, owner_wallet:process.env.TBTC_UserPoolAddress, btc_quantity:alteredQuantity, open_interest:parseFloat(contractParams.openInterest)})
    let response = await canisterInstance.call('create_option_contract',{signature:contractParams.icpAuthSignature,strike_price:parseInt(contractParams.strikePrice), premium:alteredPremium, owner:contractParams.walletAddress, message:contractParams.icpAuthString, expiration_date:reqExpDate, owner_wallet:process.env.TBTC_UserPoolAddress, btc_quantity:alteredQuantity, open_interest:parseFloat(contractParams.openInterest)})   
    console.log("response",response)
    return response
}

//icp method to buy an icp contract
const buyIcpContract = async(contractId,currentOwner,newOwner,reqObj) =>{
    console.log("icpLog",reqObj)
    signForIcpAuth = reqObj.signForIcpAuth
    icpLoginHash = reqObj.icpLoginHash
    console.log("icpLog",{id:contractId, signature:signForIcpAuth,holder_wallet:process.env.TBTC_UserPoolAddress, message:icpLoginHash,holder:newOwner})
    let response = await canisterInstance.call('buy_option_contract',{id:contractId, signature:signForIcpAuth,holder_wallet:process.env.TBTC_UserPoolAddress, message:icpLoginHash,holder:newOwner})   
    console.log("response",response)
    return response
}

//method to send locked BTC in canister of a expired contract to the creator of the contract
const expireIcpContractForCreator = async(contractId,signForIcpAuth,icpLoginHash) =>{
    let response = await canisterInstance.call('expire_option_contract',{id:contractId, signature:signForIcpAuth, message:icpLoginHash})   
    console.log("response",response)
    return response
}

//method to send locked BTC in canister of a expired contract to the owner of the contract
const expireIcpContractForOwner = async(contractId,signForIcpAuth,icpLoginHash) =>{
    console.log("expireLog",{id:contractId, signature:signForIcpAuth, message:icpLoginHash})
    let response = await canisterInstance.call('exercise_option_contract',{id:contractId, signature:signForIcpAuth, message:icpLoginHash})   
    console.log("response",response)
    return response
}

//method to get information of the call option contract
const getOptionContract = async(contractId)=>{
    let response = await canisterInstance.call('get_option_contract',contractId)   
    console.log("response2",response)
    return response
}

//method to get canister balance 
const getPoolBalance = async(poolAddress)=>{
    let response = await canisterInstance.call('get_pool_balance',poolAddress)   
    console.log("response3",response)
    return response
}

module.exports = {
    getCanisterPoolAddress,
    createIcpContract,
    buyIcpContract,
    expireIcpContractForCreator,
    expireIcpContractForOwner,
    getOptionContract,
    getPoolBalance
}