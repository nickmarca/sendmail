const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

require('./models/User');
require('./models/Survey');
require('./services/passport');

const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const passport = require('passport');
const express = require('express');
const keys = require('./config/keys');
const app = express();

app.use(bodyParser.json());

app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [keys.cookieKey]
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(keys.mongoURI);

app.use(require('./routes/authRoutes'));
app.use(require('./routes/billingRoutes'));
app.use(require('./routes/surveyRoutes'));


if(process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));

  const path = require('path');
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

const PORT = 8080;
app.listen(PORT);