const ic = require('ic0');
let canisterId = process.env.CANISTER_ID
let canisterInstance = ic(canisterId)

const createIcpContract = async(contractParams) =>{   
    let response = await canisterInstance.call('create_option_contract',{strike_price:parseInt(contractParams.strikePrice), premium:parseInt(contractParams.premium), owner:contractParams.walletAddress, exercised:false, holder:contractParams.walletAddress, expiration_date:contractParams.expirationDate, btc_quantity:parseFloat(contractParams.quantity), open_interest:parseFloat(contractParams.openInterest)})   
    console.log("response",response)
    return response
}


const buyIcpContract = async(contractId,newOwner) =>{
    let response = await canisterInstance.call('buy_option_contract',{id:contractId, holder:newOwner})   
    return response
}

module.exports = {
    createIcpContract,
    buyIcpContract
}