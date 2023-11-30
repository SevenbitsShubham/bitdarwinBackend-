const express = require("express");
const app = express()
require("dotenv/config")
const cors = require('cors')
const db = require('./models/index.js')
const apiRouter = require('./routes/apiRoutes.js')
const port = 5000
const moneyMakerController = require('./controller/moneyMakerController.js')
const cron = require("node-cron");


app.use(cors())
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use('/app',apiRouter)

// cron.schedule("*/15 * * * * *", moneyMakerController.checkStrikePrice)


db.sequelize.sync({alter:true}).then(()=>{
    // db.sequelize.sync().then(()=>{
    app.listen(port,()=>console.log(`Server is listening on port ${port}.`))
})

