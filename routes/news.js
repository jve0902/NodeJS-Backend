const moduleNews = require('../models/news'),
    //express = require('express'),
    {Router} = require('express'),
    promise = require('bluebird'),
    auth = require('../config/auth'),
    mongoose = require('mongoose'),
    {Engine} = require('../lib/engine');

mongoose.Promise = promise;
const recommendationEngine = new Engine();
const router = new Router();

const MAX_LIMIT = 12;

const createSlug = title =>
    title.replace(/[^\w\s]/gi, '').trim().toLowerCase().replace(/\W+/g, '-');

const createSubtitle = article =>
    article.substring(0, 200).replace(/\r?\n|\r/g, '').trim();

// noinspection JSUnresolvedFunction
router.route('/')
//this route will get the data from the data base and respond to the request with required fields
    .get((req, res) => {
        const page = Math.max(1, parseInt(req.query.page));  //used by skip for skipping the already loaded news
        const source = req.query.source;
        if (source) {
            moduleNews.News
                .find({published: true, deleted: false, source: source})
                .sort({createdAt: -1})
                .skip((page - 1) * MAX_LIMIT)    //skips already loaded news
                .limit(MAX_LIMIT)   //loads 12 news from database
                .select('title source cover slug subtitle url saves views date createdAt')
                .exec()
                .then(result => {
                    if (result) res.status(200).json(result);
                    else res.status(400).json({error: 'Internal server error.'});
                })
                .catch(err => res.status(400).json({error: err.message}))
        } else res.status(404).json({error: 'Source not provided.'});
    })
    //this route will post the json data generated by python to the database
    //add auth.isAuth middleware once done testing post request locally
    .post((req, res) => {
        //The res.user checks if the user is making the request. If not then the else statement is executed
        // if (!req.user) {
        //     res.status(401).json({
        //         error: 'Unauthorized'
        //     });
        // } else
        if (req.body.title && req.body.source) {
            const params = {};
            params.title = req.body.title;
            params.source = req.body.source;
            if (req.body.cover) params.cover = req.body.cover;
            if (req.body.tags && req.body.tags.length > 0) params.tags = req.body.tags;
            if (req.body.article) {
                params.article = req.body.article;
                params.subtitle = createSubtitle(params.article);
            }
            if (req.body.url) params.url = req.body.url;
            params.slug = createSlug(params.title);
            params.published = true;
            params.deleted = false;

            const news = new moduleNews.News(params);
            news.save(err => {
                if (err) {
                    console.log(err.name + ':', err.message);
                    // mongoose validation failed
                    if (err.errors) {
                        let msg = '';
                        for (const e of Object.values(err.errors))
                            msg += e.message + ', ';
                        msg = msg.substring(0, msg.length - 2);
                        res.status(400).json({message: msg});
                        // something else
                    } else
                        res.status(404).json({message: err.message});
                } else
                    res.status(201).json({msg: 'Item created successfully.'});
            });
        } else
            res.status(401).json({error: 'All information not provided.'});
    });

router.route('/recommendations')
    .get((req, res) => {
        res.status(401).json({error: 'All information not provided.'});
    });

router.route('/trending')
    .get((req, res) => {
        res.status(401).json({error: 'All information not provided.'});
    });

router.route('/:id')
    .get(auth.isAuthUser, (req, res) => {
        const id = req.params.id;
        if (id) {
            moduleNews.News
            //this will find the specific news using the ID associated with it and return all fields
                .findOneAndUpdate({_id: id}, {$inc: {views: 1}}, {new: true})
                .exec()
                .then(doc => {
                    //checks if result obtained and then return status 200 or return status 400
                    if (doc) {
                        res.status(200).json(doc);
                        // update views for recommendation system
                        if (req.user) recommendationEngine.views.add(req.user, doc)
                    } else res.status(400).json({Error: 'Internal Server Error'});
                })
                .catch(err => res.status(400).json({Error: err.message}));
        }
        //if ID not found then return status 404 with error message "Error: 'ID not provided'"
        else res.status(404).json({Error: 'ID not provided'});
    })
    .post((req, res) => {
        res.sendStatus(404);
    })
    .delete(auth.isAuth, (req, res) => {
        const id = req.param.id;
        if (id) {
            moduleNews.News
                .findOneAndUpdate({_id: id}, {hidden: true})
                .exec()
                .then(result => {
                    if (result) res.status(201).json({msg: 'Item created successfully'});
                    else res.sendStatus(400).json({Error: 'Internal Server Error'})
                })
        } else res.sendStatus(404);
    });

router.route('/:id/save')
    .get((req, res) => {
        // noinspection JSUnresolvedVariable
        const savecheck = req.query.savecheck;
        const id = req.params.id;
        if (savecheck === 'true') {
            if (id) {
                moduleNews.News
                    .findOneAndUpdate({_id: id}, {$inc: {saves: 1}}, {new: true})
                    .exec()
                    .then(result => {
                        if (result) res.status(200).json(result);
                        else res.status(400).json({Error: 'Internal Server Error'});
                    })
            } else res.status(404).json({Error: 'ID not provided'});
        } else if (savecheck === 'false') {
            if (id) {
                moduleNews.News
                    .findOneAndUpdate({_id: id}, {$inc: {saves: -1}}, {new: true})
                    .exec()
                    .then(result => {
                        if (result) res.status(200).json(result);
                        else res.status(400).json({Error: 'Internal Server Error'});
                    })
            } else res.status(404).json({Error: 'ID not provided'});
        }
    });

module.exports = router;
