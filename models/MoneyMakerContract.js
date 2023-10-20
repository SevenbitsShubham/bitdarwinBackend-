const sequelize = require('sequelize');
const Transaction = require('./Transaction');

module.exports = (sequelize,DataTypes) =>{
    const MoneyMakerContract = sequelize.define("MoneyMakerContract",{
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
        quantity:{
            type: DataTypes.FLOAT,  
        },
        currency:{
            type: DataTypes.STRING,
        },
        title:{
            type: DataTypes.STRING,
        },
        buyer:{
            type: DataTypes.STRING,
        },
        seller:{
            type: DataTypes.STRING,
        },
        governingLaw:{
            type: DataTypes.STRING,
        },
        propertyAddress:{
            type: DataTypes.STRING,
        },
        sellingPrice:{
            type: DataTypes.FLOAT,
        },
        terms:{
            type: DataTypes.STRING,
        },
        deployment:{
            type: DataTypes.STRING,
            validate:{
                isIn:[['BitGo','ICP']]
            }
        },
        contractType:{
            type: DataTypes.STRING,
            validate:{
                isIn:[['MoneyMaker','HousingContract' ]]
            }
        },
        status:{
            type: DataTypes.STRING,
            validate:{
                isIn:[['pending','inprocess','inprocess-resell','processedWithAboveStrikePrice','processedWithBelowStrikePrice']]
            }
        },
        contractAddress:{
            type: DataTypes.STRING,
        },
        buyAvailable:{
            type: DataTypes.BOOLEAN,  
            defaultValue:true
        },
        contract:{
            type: DataTypes.TEXT
        }
    })

    MoneyMakerContract.associate= (models) =>{
        MoneyMakerContract.hasMany(models.Transaction,{
            foreignKey:"contractId",
            targetKey:"id",
        })
        
        MoneyMakerContract.belongsTo(models.User,{
            foreignKey:"ownerId",
            targetKey:"userId",
            as: 'OwnerId'
        })

        MoneyMakerContract.belongsTo(models.User,{
            foreignKey:"createrId",
            targetKey:"userId",
            as: 'CreaterId'
        })
    }

    return MoneyMakerContract
}