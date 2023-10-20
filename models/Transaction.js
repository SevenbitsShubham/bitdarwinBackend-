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
        contractId:{
            type:DataTypes.INTEGER,
            references:{
                model:'MoneyMakerContracts',
                key:'id'
            }
        },
        txType:{
            type:DataTypes.STRING,
        },
        txAmount:{
            type:DataTypes.STRING,  
        },
        fees:{
            type:DataTypes.FLOAT,
        },
        sqlQuery:{
            type: DataTypes.TEXT,
        },
        queryHex:{
            type: DataTypes.TEXT,
        },
        signature:{
            type: DataTypes.STRING,
        },
        txHash:{
            type: DataTypes.TEXT,
        },
        status:{
            type: DataTypes.STRING,
        }        
    })

    Transaction.associate = (models)=>{
        Transaction.belongsTo(models.MoneyMakerContract,{
            foreignKey:"contractId",
            targetKey:"id",
        })

        Transaction.belongsTo(models.User,{
            foreignKey:"userId",
            targetKey:"userId",
           })
    }

    return Transaction
    
}