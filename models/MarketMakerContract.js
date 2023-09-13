const sequelize = require('sequelize');

module.exports = (sequelize,DataTypes) =>{
    const MarketMakerContract = sequelize.define("MarketMakerContract",{
        id:{
            type: DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true

        },
        strikePrice:{
            type: DataTypes.INTEGER,
        },
        premium:{
            type: DataTypes.INTEGER,
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
        query:{
            type: DataTypes.STRING,
        },
        signature:{
            type: DataTypes.STRING,
        }      
    })
    return MarketMakerContract
}