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
            unique:true,
            allowNull:false
        }
    })

    User.associate= (models)=>{
       User.hasMany(models.Transaction,{
        foreignKey:"userId",
        targetKey:"userId",
       })
       
       User.hasMany(models.MarketMakerContract,{
        foreignKey:"userId",
        targetKey:"userId",
       })
    }

    return User;
}