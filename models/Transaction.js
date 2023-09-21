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
        txType:{
            type:DataTypes.STRING,
        },
        txAmount:{
            type:DataTypes.STRING,  
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

    Transaction.associate = (models)=>{
        Transaction.belongsTo(models.MoneyMakerContract,{
            foreignKey:'txId'
        })
    }

    return Transaction
    
}