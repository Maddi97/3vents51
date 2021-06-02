// modules =================================================
const express = require('express');
// set our port
const port = 3000;
const app = express();
var cors = require('cors')

// configuration ===========================================
const mongoose = require("./config/mongoose")

app.use(express.json())
app.use(cors())

var organizerRouter = require('./routes/organizer.routes')
app.use(organizerRouter)

var eventRouter = require('./routes/event.routes')
app.use(eventRouter)

var categoryRouter = require('./routes/category.routes')
app.use(categoryRouter)
// startup our app at http://localhost:3000

var fileRouter = require('./routes/file.routes')
app.use(fileRouter)

app.listen(port, () =>
  console.log(`3vents51 backend listening on port ${port}!`)
);
