const Web3 = require('web3')
const BN = require("bignumber.js")
const BitGo = require('bitgo');
const dotenv = require("dotenv").config().parsed;
const bitgo = new BitGo.BitGo({accessToken:process.env.BITGO_AccessToken}); 
const abiDecoder = require('abi-decoder')
const {usdcAddress,usdcAbi} = require('./usdcContract')

let web3 = new Web3(`https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`)  

const validateDepositTx = async(txHash,quantity=null,userWalletAddress=null,recieverAddreess=process.env.WBTC_UserPoolAddress) =>{
    return await new Promise((resolve,reject)=>{
        let count =1
        let txInterval = setInterval(async()=>{
            let result= await web3.eth.getTransactionReceipt(txHash)     
            // console.log("t45",result)
            if(result?.status){
                let tx =await web3.eth.getTransaction(txHash)
                // console.log("tx",tx)
                const inputData = tx.input;
                abiDecoder.addABI(usdcAbi)
                let decodedData = abiDecoder.decodeMethod(tx.input)
                // console.log("decodedData",decodedData)
                let toObj,valueObj 
                decodedData.params.map((data)=>{
                    if(data.name === '_to'){
                        toObj = data
                    }

                    if(data.name==='_value'){
                        valueObj = data
                    }
                })
                // console.log("log",toObj.value ,process.env.USDC_Wallet,toObj.value == process.env.USDC_Wallet)
                if(toObj.value.toLowerCase() == process.env.USDC_Wallet.toLowerCase()){
                    resolve({status:'Success',amount:valueObj.value})                    
                }
                else{
                    resolve({status:'Reject',amount:valueObj.value})                    
                }
            // console.log('result',result,count,result.from.toString(), userWalletAddress.toString(),result.to,recieverAddreess )
                // if(userWalletAddress){
                    // console.log("debug67",result.from ,userWalletAddress ,result.to ,recieverAddreess)
                    //for contract creation from : 0xf58e7f435c2df7d671bc8dd610f36eade19a3c96 to:0x7de01d5f2bef56bdfb9971a270ecd13cac287799
                    //for balance from: to:0xd4bccebe77b7c1da89818f8889e3ea09046e7e38 
                    // if(result.to === '0xd4bccebe77b7c1da89818f8889e3ea09046e7e38'){ //&& result.to === recieverAddreess
                    //     resolve('Success')
                    // }
                    // else{
                    //     resolve('Failed')
                    // }
                    // resolve('Success')
                // }
                // else{
                //     resolve('Success')
                // }
                clearInterval(txInterval)
            }

            if(count === 10 ){
                resolve('Pending') 
                clearInterval(txInterval)
            }

            count++                        
        },10000)                    
    })  

}


async function sendTransaction(address, amount, walletId, encryptedString, walletPassphrase,deployment) {
    console.log("====================================================== SENDING TBTC TO MARKETMAKERS =================================================")
        let amountinDecimal = new BN(amount).times(dotenv.TBTC_Decimal).toFixed(0).toString()
        console.log(amountinDecimal)
        let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: walletId });
        let walletBalance = new BN(wallet._wallet.balanceString).dividedBy(dotenv.TBTC_Decimal).toString()

        console.log("txLog1",walletBalance)
        try {

            let prebuild = await wallet.prebuildTransaction({
                recipients: [{address:address,amount:amountinDecimal}]
            })

            // console.log("txLog2",prebuild)
            let decryptedString = bitgo.decrypt({password: walletPassphrase, input: encryptedString }) 

            // console.log("txLog3",decryptedString)
            let signedTX = await wallet.signTransaction({ txPrebuild: prebuild, prv: decryptedString })
            
            // console.log("txLog4",signedTX)
            let sendTransaction = await wallet.submitTransaction({
                txHex: signedTX.txHex
            })

            // console.log("debug6",signedTX,"wallet",wallet,"sendTx",sendTransaction)

            let txStatus
            if(deployment === 'ICP'){
                txStatus =await validateTx(wallet,sendTransaction.txid,amountinDecimal,address)
            }
            else{
                txStatus =await validateTx(wallet,sendTransaction.txid,amountinDecimal)
            }
            console.log("debug7",txStatus)
            // let txStatus= await validateTx(wallet,sendTransaction.txid,amountinDecimal,walletId,process.env.WBTC_PoolAddress)
            // console.log("debug7",txStatus)
            let reqQuantity
            if(txStatus.status == "Success"){
                reqQuantity=new BN(txStatus.quantity).dividedBy(dotenv.TBTC_Decimal).toString()
            }
            let payload = {
                TransactionHash: sendTransaction.txid,
                status: txStatus.status,
                quantity:reqQuantity
            }
            return payload            
    }

catch (error) {
    console.log(error)
}
}

const validateTx = async(walletInstance,transactionHash,quantity=null,userWalletAddress=null,recieverAddreess=process.env.TBTC_PoolAddress) =>{
    return await new Promise((resolve,reject)=>{
        let count =1
        let txInterval = setInterval(async()=>{
            let transfer = await walletInstance.getTransfer({id:transactionHash})
            // let result= await web3.eth.getTransactionReceipt(txHash)     
            console.log('result',transfer.state,count)
            if(transfer.state === "confirmed" || transfer.state === "failed" ){
                console.log("debug7",JSON.stringify(transfer))
                if(transfer.state === "confirmed"){
                    let findAddressProof 
                    if(userWalletAddress ){
                    // console.log("findAddressProof",transfer.outputs)
                        findAddressProof = transfer.outputs.find(element=>element.address === userWalletAddress)
                        console.log("findAddressProof",transfer.outputs,'ffff',findAddressProof)
                    }
                    else{
                        // console.log("log51",Object.keys(transfer),transfer.output,process.env.TBTC_HotWalletId)
                    findAddressProof = transfer.outputs.find(element=>{
                        console.log("logger",element.wallet === process.env.TBTC_HotWalletId.toString(),element.wallet ,process.env.TBTC_HotWalletId.toString())
                        if(element.wallet === process.env.TBTC_HotWalletId.toString()){
                            return element 
                        }
                        
                    })
                    }

                    if(quantity){
                    // console.log("logger2",findAddressProof,parseInt(quantity) === (-1*parseInt(transfer.baseValue)),quantity ,(-1*parseInt(transfer.baseValue)))
                        if(parseInt(quantity) === (-1*parseInt(transfer.baseValue)) && findAddressProof){ 
                            resolve({status:'Success',quantity})
                        }
                        else{
                            resolve({status:'invalidTx',quantity})
                        }
                    }
                    else{
                        if(findAddressProof){ 
                            resolve({status:'Success',quantity:(-1*parseInt(transfer.baseValue))})
                        }
                        else{
                            resolve({status:'invalidTx',quantity})
                        }
                    }
                }
                else if(transfer.state ==="failed"){
                    resolve({status:'Rejected',quantity})
                }
                clearInterval(txInterval)
            }

            if(count === 120 ){
                resolve({status:'Pending',quantity}) 
                clearInterval(txInterval)
            }

            count++                        
        },10000)                    
    })  

}

// let wallet = await bitgo.coin(dotenv.TBTC_Coin).wallets().get({ id: walletId });
// let tx= validateTx(wallet,'9d65bc7b87ec1ac33a931b0bc3c18a56c8391b9bba037851c58ea9d6ef1ee401',1020000,'mrcj6HfXtp1pUy5AB3RBQW8oFRW2u9YLGh')
// console.log("tx",tx)

module.exports ={
    validateDepositTx,
    sendTransaction,
    validateTx
}