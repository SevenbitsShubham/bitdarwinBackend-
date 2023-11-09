const sequelize = require('sequelize')

module.exports = (sequelize,DataTypes) =>{
    const User = sequelize.define("User",{
        userId:{
            type:DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true
        },
        walletAddress:{
            type:DataTypes.STRING,
            // unique:true,
            // allowNull:false
        },
        balance:{
            type:DataTypes.FLOAT,
            defaultValue: 0
        }
    })

    User.associate= (models)=>{
       User.hasMany(models.Transaction,{
        foreignKey:"userId",
        targetKey:"userId",
       })
       
       User.hasMany(models.MoneyMakerContract,{
        foreignKey:"ownerId",
        targetKey:"userId",
       })

       User.hasMany(models.MoneyMakerContract,{
        foreignKey:"createrId",
        targetKey:"userId",
       })
    }

    return User;
}