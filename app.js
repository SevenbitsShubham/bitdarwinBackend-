const express = require("express");
const app = express()
require("dotenv/config")
const cors = require('cors')
const db = require('./models/index.js')
const apiRouter = require('./routes/apiRoutes.js')
const port = 5000

app.use(cors())
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use('/api',apiRouter)

db.sequelize.sync({alter:true}).then(()=>{
    app.listen(port,()=>console.log(`Server is listening on port ${port}.`))
})