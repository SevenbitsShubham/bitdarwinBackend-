const ic = require('ic0');
let canisterId = process.env.CANISTER_ID
let canisterInstance = ic(canisterId)

const createIcpContract = async(contractParams) =>{   
    let response = await canisterInstance.call('create_contract',{strike_price:parseInt(contractParams.strikePrice), premium:parseInt(contractParams.premium), owner:contractParams.walletAddress, exercised:false, holder:contractParams.walletAddress, expiration_date:1, btc_quantity:1, open_interest:parseInt(contractParams.openInterest)})   
    console.log("response",response)
    return response
}


const buyIcpContract = async(contractParams) =>{
    let response = await canisterInstance.call('buy_contract',{id:parseInt(contractParams.contractId), holder:contractParams.newBuyer, owner:contractParams.walletAddress, exercised:false, holder:contractParams.walletAddress, expiration_date:1, btc_quantity:1, open_interest:parseInt(contractParams.openInterest)})   
    return response
}

module.exports = {
    createIcpContract
}