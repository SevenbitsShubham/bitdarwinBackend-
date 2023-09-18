const sequelize = require('sequelize');
const Transaction = require('./Transaction');

module.exports = (sequelize,DataTypes) =>{
    const MarketMakerContract = sequelize.define("MarketMakerContract",{
        id:{
            type: DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true

        },
        ownerId:{
            type:DataTypes.INTEGER,
            references:{
                model:'Users',
                key:'userId'
            }
        },
        createrId:{
            type:DataTypes.INTEGER,
            references:{
                model:'Users',
                key:'userId'
            }
        },
        txId:{
            type: DataTypes.INTEGER,
            references:{
                model:'Transactions',
                key:'txId'
            }
        },
        strikePrice:{
            type: DataTypes.INTEGER,
        },
        premium:{
            type: DataTypes.FLOAT,
        },  
        openInterest:{
            type: DataTypes.INTEGER,
        },
        expirationDate:{
            type: DataTypes.DATE,
        },
        status:{
            type: DataTypes.STRING,
        },
           contractAddress:{
            type: DataTypes.STRING,
        },
        buyAvailable:{
            type: DataTypes.BOOLEAN,  
            defaultValue:true
        }
    })

    MarketMakerContract.associate= (models) =>{
        MarketMakerContract.hasOne(models.Transaction,{
            foreignKey:"txId",
            targetKey:"txId",
    })
    }

    return MarketMakerContract
}