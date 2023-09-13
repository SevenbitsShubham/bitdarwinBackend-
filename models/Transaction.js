const sequelize = require("sequelize")

module.exports = (sequelize,DataTypes)=>{
    const Transaction = sequelize.define("Transaction",{
        txId:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId:{
            type:DataTypes.INTEGER,
            references:{
                model:'Users',
                key:'userId'
            }
        },
        sqlQuery:{
            type: DataTypes.STRING,
        },
        queryHex:{
            type: DataTypes.STRING,
        },
        signature:{
            type: DataTypes.STRING,
        }        
    })

    return Transaction
}