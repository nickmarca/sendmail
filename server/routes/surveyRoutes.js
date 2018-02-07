const router = require('express').Router();
const mongoose = require('mongoose');
const Path = require('path-parser');
const { URL } = require('url');
const {map, filter, uniqWith, compose, each} = require('lodash/fp');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplates/surveyTemplate');

const Survey = mongoose.model('surveys');

router.get('/api/surveys', requireLogin, async (req, res) => {
  const surveys = await Survey.find({ _user: req.user.id }).select({ recipients: false });
  res.send(surveys);
});

router.post('/api/surveys', requireLogin, requireCredits, async (req, res) => {
  const { title, subject, body, recipients } = req.body;
  const survey = new Survey({
    dateSent: Date.now(),
    title,
    subject,
    body,
    recipients: recipients.split(',').map(email => ({ email: email.trim() })),
    _user: req.user.id
  });

  try {
    const mailer = new Mailer(survey, surveyTemplate(survey));
    await mailer.send();
    await survey.save();
    req.user.credits -= 1;
    const user = await req.user.save();
    res.send(user);
  } catch(err) {
    res.status(422).send(err);
  }
});

router.get('/api/surveys/:surveyId/:choice', (req, res) => {
  res.send('Thanks for voting!');
});

router.post('/api/surveys/webhooks', (req, res) => {

  const extract = ({email, url}) => {
    const match = new Path('/api/surveys/:surveyId/:choice').test(new URL(url).pathname);
    return match ? {email, surveyId: match.surveyId, choice: match.choice} : null;
  };

  const update = ({email, surveyId, choice}) => {
    Survey.updateOne({
      _id: surveyId,
      recipients: {
        $elemMatch: {email, responded: false}
      }
    }, {
      $inc: {[choice]: 1},
      $set: {'recipients.$.responded': true},
      lastResponded: new Date()
    }).exec();
  };

  const isUniq = (i, j) => (i.email === j.email) && (i.surveyId === j.surveyId);
  const noNull = val => val;

  compose(
    each(update),
    uniqWith(isUniq),
    filter(noNull),
    map(extract)
  )(req.body || []);

  res.send({});
});

module.exports = router;